const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Transaction = require('../models/Transaction.model');
const User = require('../models/User.model');
const { createNotification } = require('../utils/notification.utils');

// ─── Get wallet balance & history ─────────────────────────────────────────────
exports.getWallet = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('walletBalance name');
    const transactions = await Transaction.find({
      $or: [{ sender: req.user._id }, { recipient: req.user._id }]
    })
      .populate('sender', 'name avatarUrl')
      .populate('recipient', 'name avatarUrl')
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      balance: user.walletBalance,
      transactions
    });
  } catch (error) {
    next(error);
  }
};

// ─── Deposit (Stripe Payment Intent) ─────────────────────────────────────────
exports.createDeposit = async (req, res, next) => {
  try {
    const { amount } = req.body; // amount in USD
    const amountInCents = Math.round(amount * 100);

    // Create Stripe Payment Intent
    let paymentIntent;
    try {
      // Ensure customer exists in Stripe
      let customerId = req.user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: req.user.email,
          name: req.user.name,
          metadata: { userId: req.user._id.toString() }
        });
        customerId = customer.id;
        await User.findByIdAndUpdate(req.user._id, { stripeCustomerId: customerId });
      }

      paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: 'usd',
        customer: customerId,
        metadata: { userId: req.user._id.toString(), type: 'deposit' }
      });
    } catch (stripeError) {
      // Mock mode for development (when Stripe keys not configured)
      console.warn('Stripe not configured, using mock mode');
      return mockDeposit(req, res, amount);
    }

    // Create pending transaction record
    const transaction = await Transaction.create({
      type: 'deposit',
      amount,
      currency: 'USD',
      recipient: req.user._id,
      status: 'pending',
      description: `Wallet deposit of $${amount}`,
      stripePaymentIntentId: paymentIntent.id
    });

    res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      transactionId: transaction._id,
      message: 'Payment intent created. Complete payment on client.'
    });
  } catch (error) {
    next(error);
  }
};

// Mock deposit for dev/sandbox
const mockDeposit = async (req, res, amount) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { $inc: { walletBalance: amount } });
    const transaction = await Transaction.create({
      type: 'deposit',
      amount,
      currency: 'USD',
      recipient: req.user._id,
      status: 'completed',
      description: `Mock wallet deposit of $${amount}`,
      processedAt: new Date()
    });
    return res.status(200).json({
      success: true,
      message: `$${amount} deposited (mock mode).`,
      transaction
    });
  } catch (error) {
    throw error;
  }
};

// ─── Confirm Deposit (Stripe Webhook or manual) ───────────────────────────────
exports.confirmDeposit = async (req, res, next) => {
  try {
    const { transactionId } = req.params;
    const transaction = await Transaction.findById(transactionId);
    if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found.' });
    if (transaction.status === 'completed') {
      return res.status(200).json({ success: true, message: 'Already completed.', transaction });
    }

    transaction.status = 'completed';
    transaction.processedAt = new Date();
    await transaction.save();

    await User.findByIdAndUpdate(transaction.recipient, {
      $inc: { walletBalance: transaction.amount }
    });

    res.status(200).json({ success: true, message: 'Deposit confirmed.', transaction });
  } catch (error) {
    next(error);
  }
};

// ─── Withdrawal ───────────────────────────────────────────────────────────────
exports.createWithdrawal = async (req, res, next) => {
  try {
    const { amount, bankDetails } = req.body;
    const user = await User.findById(req.user._id).select('walletBalance');

    if (user.walletBalance < amount) {
      return res.status(400).json({ success: false, message: `Insufficient balance. Available: $${user.walletBalance}` });
    }

    // Deduct balance
    await User.findByIdAndUpdate(req.user._id, { $inc: { walletBalance: -amount } });

    const transaction = await Transaction.create({
      type: 'withdrawal',
      amount,
      currency: 'USD',
      sender: req.user._id,
      status: 'completed', // In production this would be 'pending' until bank processes
      description: `Withdrawal of $${amount}`,
      metadata: { bankDetails },
      processedAt: new Date()
    });

    res.status(200).json({ success: true, message: `$${amount} withdrawal initiated.`, transaction });
  } catch (error) {
    next(error);
  }
};

// ─── Transfer (Investor → Entrepreneur) ──────────────────────────────────────
exports.createTransfer = async (req, res, next) => {
  try {
    const { recipientId, amount, description, dealId } = req.body;

    const sender = await User.findById(req.user._id).select('walletBalance role');
    const recipient = await User.findById(recipientId).select('name role');

    if (!recipient) return res.status(404).json({ success: false, message: 'Recipient not found.' });
    if (sender.walletBalance < amount) {
      return res.status(400).json({ success: false, message: `Insufficient balance. Available: $${sender.walletBalance}` });
    }

    // Atomic balance update
    await User.findByIdAndUpdate(req.user._id, { $inc: { walletBalance: -amount } });
    await User.findByIdAndUpdate(recipientId, { $inc: { walletBalance: amount } });

    const transaction = await Transaction.create({
      type: 'transfer',
      amount,
      currency: 'USD',
      sender: req.user._id,
      recipient: recipientId,
      status: 'completed',
      description: description || `Transfer of $${amount} to ${recipient.name}`,
      dealId,
      processedAt: new Date()
    });

    // Notify recipient
    await createNotification({
      recipient: recipientId,
      type: 'payment_received',
      title: 'Payment Received',
      message: `You received $${amount} from ${req.user.name}.`,
      relatedId: transaction._id.toString()
    });

    const populated = await transaction.populate(['sender', 'recipient'], 'name avatarUrl');
    res.status(200).json({ success: true, message: `$${amount} transferred successfully.`, transaction: populated });
  } catch (error) {
    next(error);
  }
};

// ─── Transaction History ──────────────────────────────────────────────────────
exports.getTransactions = async (req, res, next) => {
  try {
    const { type, status, page = 1, limit = 20 } = req.query;
    const query = { $or: [{ sender: req.user._id }, { recipient: req.user._id }] };
    if (type) query.type = type;
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .populate('sender', 'name avatarUrl role')
        .populate('recipient', 'name avatarUrl role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Transaction.countDocuments(query)
    ]);

    res.status(200).json({ success: true, transactions, pagination: { page: parseInt(page), total } });
  } catch (error) {
    next(error);
  }
};

// ─── Stripe Webhook ───────────────────────────────────────────────────────────
exports.stripeWebhook = async (req, res, next) => {
  try {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      return res.status(400).json({ success: false, message: `Webhook Error: ${err.message}` });
    }

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const transaction = await Transaction.findOne({ stripePaymentIntentId: paymentIntent.id });
      if (transaction && transaction.status === 'pending') {
        transaction.status = 'completed';
        transaction.processedAt = new Date();
        transaction.stripeChargeId = paymentIntent.latest_charge;
        await transaction.save();
        await User.findByIdAndUpdate(transaction.recipient, { $inc: { walletBalance: transaction.amount } });
      }
    }

    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object;
      await Transaction.findOneAndUpdate(
        { stripePaymentIntentId: paymentIntent.id },
        { status: 'failed', failureReason: paymentIntent.last_payment_error?.message }
      );
    }

    res.json({ received: true });
  } catch (error) {
    next(error);
  }
};
