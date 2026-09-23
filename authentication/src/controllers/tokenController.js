const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { generateAccessToken } = require("../utils/tokenService");

const refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ message: "No refresh token" });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);

    if (!user || !user.refreshTokens.includes(refreshToken)) {
      return res.status(403).json({ message: "Invalid refresh token" });
    }

    const newAccessToken = generateAccessToken(user);

    res.json({ accessToken: newAccessToken });

  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired refresh token" });
  }
};

module.exports = { refreshAccessToken };

const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    const user = await User.findOne({
      refreshTokens: refreshToken
    });

    if (!user) {
      return res.status(200).json({ message: "Logged out" });
    }

    user.refreshTokens = user.refreshTokens.filter(
      (t) => t !== refreshToken
    );

    await user.save();

    res.json({ message: "Logged out successfully" });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { refreshAccessToken, logout };