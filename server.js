// server.js - Stake Auto-Claimer 後端 API
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

// 使用者模型
const UserSchema = new mongoose.Schema({
  userId: { type: String, unique: true, required: true },
  balance: { type: Number, default: 0 },
  firstInstallTime: Date,
  trialEndTime: Date,
});
const User = mongoose.model('User', UserSchema);

// API 1: 註冊使用者 + 試用期
app.post('/api/register', async (req, res) => {
  const { userId } = req.body;
  let user = await User.findOne({ userId });
  if (!user) {
    const now = new Date();
    user = new User({
      userId,
      firstInstallTime: now,
      trialEndTime: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), // 3天試用
    });
    await user.save();
  }
  const daysLeft = Math.max(0, Math.floor((user.trialEndTime - new Date()) / 86400000));
  res.json({ inTrial: daysLeft > 0, remainingDays: daysLeft, balance: user.balance });
});

// API 2: 查詢狀態（試用 + 餘額）
app.post('/api/check-status', async (req, res) => {
  const { userId } = req.body;
  const user = await User.findOne({ userId });
  if (!user) return res.json({ inTrial: false, remainingDays: 0, balance: 0 });

  const daysLeft = Math.max(0, Math.floor((user.trialEndTime - new Date()) / 86400000));
  res.json({
    inTrial: daysLeft > 0,
    remainingDays: daysLeft,
    balance: user.balance
  });
});

// API 3: 充值確認（簡化版，生產時加 Tronscan 驗證）
app.post('/api/confirm-recharge', async (req, res) => {
  const { userId, amount } = req.body;
  let user = await User.findOne({ userId });
  if (user) {
    user.balance += Number(amount);
    await user.save();
    res.json({ success: true, balance: user.balance });
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

// API 4: 扣款（領取成功後呼叫）
app.post('/api/deduct-fee', async (req, res) => {
  const { userId, fee } = req.body;
  let user = await User.findOne({ userId });
  if (user && user.balance >= fee) {
    user.balance -= fee;
    await user.save();
    res.json({ success: true, balance: user.balance });
  } else {
    res.json({ success: false, error: 'Insufficient balance' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
