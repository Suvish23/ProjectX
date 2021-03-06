const crypto = require('crypto');
const asyncHandler = require('../middelware/async');
const ErrorRespone = require('../utils/errorresponse');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');

//@des    Register User
//@route POST /api/v1/auth/register
//@access  Public
exports.register = asyncHandler(async (req, res, next) => {
  //   res.status(200).json({ success: true });

  const { Name, email, password, role } = req.body;
  //create User
  const user = await User.create({
    Name,
    email,
    password,
    role,
  });

  //create token

  sendTokenResponse(user, 200, res);

  res.status(200).json({ success: true, token: token });
});

//@des    Register User
//@route POST /api/v1/auth/login
//@access  Public

exports.login = asyncHandler(async (req, res, next) => {
  //   res.status(200).json({ success: true });

  const { email, password } = req.body;

  //Validate email and password

  if (!email || !password) {
    return next(new ErrorRespone('Please provide an email and PAssword', 400));
  }
  //Check for User

  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    return next(new ErrorRespone('Invalid credentials', 401));
  }

  //check if password matches

  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    return next(new ErrorRespone('Invalid credentials', 401));
  }
  //create token

  sendTokenResponse(user, 200, res);

  res.status(200).json({ success: true, token });
});
//@des   Get Current Logged in User
//@route POST /api/v1/auth/me
//@access  Private

exports.getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  res.status(200).json({
    success: true,
    data: user,
  });
});
//@des  Update user details
//@route PUT /api/v1/auth/updatedetails
//@access  Private

exports.updateDetails = asyncHandler(async (req, res, next) => {
  const fieldsToUpdate = {
    Name: req.body.Name,
    email: req.body.email,
  };
  const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
    new: true,
    runValidators: true,
  });
  res.status(200).json({
    success: true,
    data: user,
  });
});
//@des   Update Password
//@route Put /api/v1/auth/updatepassword
//@access  Private

exports.updatePassword = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id).select('+password');
  //check current password
  if (!(await user.matchPassword(req.body.currentPassword))) {
    return next(new ErrorRespone('Password is Incorrect', 401));
  }
  user.password = req.body.newPassword;
  await user.save();
  sendTokenResponse(user, 200, res);
});

//@des   Forget Password
//@route POST /api/v1/auth/forgotpassword
//@access  Public
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new ErrorRespone('there is no user with that email', 404));
  }
  //get reset token
  const resetToken = user.getResetPasswordToken();
  await user.save({ validateBeforeSave: false });

  //Create rest url
  const resetUrl = `${req.protocol}://${req.get(
    'host'
  )}/api/v1/auth/resetpassword/${resetToken}`;

  const message = `You are receiving this email because you (or someone else) has requested the reset of a password. Please make a PUT request to: \n\n ${resetUrl}`;
  try {
    await sendEmail({
      email: user.email,
      subject: 'Password reset token',
      message,
    });
    res.status(200).json({ success: true, data: 'Email sent' });
  } catch (err) {
    console.log(err);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new ErrorRespone('Email could not be sent', 500));
  }
  res.status(200).json({
    success: true,
    data: user,
  });
});
//@des  Rest password
//@route PUT /api/v1/auth/resetpassword/:resettoken
//@access  Public
exports.resetPassword = asyncHandler(async (req, res, next) => {
  //Get Hashed token
  const resetPasswordToken = crypto
    .createHash('sha256')
    .update(req.params.resetToken)
    .digest('hex');
  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });
  if (!user) {
    return next(new ErrorRespone('Invalid token', 400));
  }
  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  sendTokenResponse(user, 200, res);
});
// get token from model ,create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
  //create token
  let token = user.getSignedJwtToken();
  const options = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };
  if (!process.env.NODE_ENV === 'production') {
    options.secure = true;
  }
  res.status(statusCode).cookie('token', token, options).json({
    success: true,
    token,
  });
};
