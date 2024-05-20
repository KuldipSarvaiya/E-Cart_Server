import express from "express";
import jwt from "jsonwebtoken";
import sendMail from "../sendMail.js";
import Users from "../Models/Users.js";

const UserLogin = new express.Router();

UserLogin.post("/login", async (req, res) => {
  console.log("Post Request On /login");
  console.log(req.body);
  // search user from db and get jwt and _oid
  const user = await Users.find()
    .where("email")
    .eq(req.body.email)
    .where("password")
    .eq(req.body.password)
    .select("jwt");
    
  if (user.length > 0) {
    // const otp = await sendMail(req.body.email); 
    const otp = 123456
    console.log("OTP = ", otp);
    jwt.verify(
      user[0].jwt,
      process.env.JWT_SECRET_KEY,
      (err, data) => {
        if (err) {
          console.log(err);
          res.json({ error: true, message: err.message });
        } else {
          res.json({
            error: false,
            otp: otp,
            oid: user[0]._id,
            jwt: user[0].jwt,
            data: data,
          });
        }
      }
    );
  } else
    res.json({
      error: true,
      message: "There May Be Wrong Email Or Password",
    });
});

UserLogin.post("/register", async (req, res) => {
  console.log("Post Request On /register");
  console.log(req.body);
  console.log(req.headers);
  const user = await Users.find({ email: { $eq: req.body.email } });
  if (user.length > 0) {
    res.json({
      error: true,
      message: "Already A User Have Registered With This Email",
    });
  } else {
    const otp = await sendMail(req.body.email); 
    console.log("OTP = ", otp);
    res.json({ error: false, otp: otp });
  }
});

UserLogin.post("/confirm_user", async (req, res) => {
  console.log("Post Request On /confirm_user");

  const newUser = new Users({ ...req.body, jwt: "this_is_demo_token" });
  await newUser.save().then(() => {
    console.log(
      "\nNew User Registeration details saved Succesfully...\n",
      newUser
    );
  });

  const token = jwt.sign(
    { ...req.body, _id: newUser._id },
    process.env.JWT_SECRET_KEY
  );

  const updatedUser = await Users.updateOne(
    { _id: newUser._id },
    { $set: { jwt: token } }
  );
  console.log("Updated User : ", updatedUser);

  res.json({ error: false, _id: newUser._id, jwt: token });
});

UserLogin.post("/forgot_password", async (req, res) => {
  console.log("Post Request On /forgot_password", req.body);
  const user = await Users.find({ email: { $eq: req.body.email } });
  console.log(user);
  if (user.length > 0) {
    const otp = await sendMail(req.body.email); 
    console.log("OTP = ", otp);
    res.json({ error: false, otp });
  } else
    res.json({
      error: true,
      message: "No Any User Exists Having Registered With This Email",
    });
});

UserLogin.post("/change_password", async (req, res) => {
  console.log("Post Request On /change_password", req.body);
  const user = await Users.find({ email: { $eq: req.body.email } });
  const token = jwt.sign(
    {
      _id: user[0]._id,
      role: user[0].role,
      name: user[0].name,
      surname: user[0].surname,
      password: req.body.password,
      email: user[0].email,
      phone: user[0].phone,
      shop_address: user[0].address,
      payment_dtl: user[0].payment_dtl,
      gender: user[0].gender,
    },
    process.env.JWT_SECRET_KEY
  );
  const updatedSeller = await Users.updateOne(
    { email: req.body.email },
    { $set: { password: req.body.password, jwt: token } }
  );
  res.json({
    error: false,
    oid: user._id,
    jwt: token,
  });
});

export default UserLogin;
