
const db = require("../models");
const config = require("../config/auth.config");

const User = db.user;
const AuthDetail = db.authdetail;

var jwt = require("jsonwebtoken");
var bcrypt = require("bcryptjs");
var moment = require('moment');
var {recoverPersonalSignature} = require('@metamask/eth-sig-util');
var {bufferToHex} = require('ethereumjs-util');



const getRandomNonceMessage= (nonce) =>{
    return 'Please prove you control this wallet by signing this random text: ' + nonce;
}

 /** Save and get a unique challenge for signing by user. */
 exports.auth_challenge = async (req, res) => {
  const address = req.body.address.toLowerCase();
  const nonce = Math.floor(Math.random() * 1000000).toString();
  const unix = moment().unix();
  try {
    let user = await db.user.findOne({ address: address }).populate("authdetails");
    if (!user) {
      // Create a new user if not found
      user = await db.user.create({ address: address });
    }
    console.log("User found:", user);

    // Create or update auth details
    let authDetail;
    if (!user.authdetails) {
      // Create new auth details
      authDetail = await db.authdetail.create({ nonce: nonce, timestamp: unix });
      user.authdetails = authDetail._id;
    } else {
      // Update existing auth details
      authDetail = await db.authdetail.findByIdAndUpdate(user.authdetails, { nonce: nonce, timestamp: unix }, { new: true });
    }
    await user.save(); // Save the updated user

    console.log("User auth details:", authDetail);
    res.status(200).send({ message: getRandomNonceMessage(nonce) });
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: error.message });
  }
};



  

exports.auth_verify = async (req, res) => {
  const address = req.body.address.toLowerCase();
  const signature = req.body.signature;
  console.log("Received address:", address);
  console.log("Received signature:", signature);
  try {
    // load user by public address
    const user = await db.user.findOne({ address: address }).populate("authdetails");
    if (!user) {
      console.log("User not found");
      return res.status(401).send({ message: "User Not found." });
    }
    // get authdetails for user
    if (!user.authdetails) {
      console.log("Auth details not found");
      return res.status(401).send({ message: "Auth details not found." });
    }
    const nonce = user.authdetails.nonce;
    const timestamp_challenge = user.authdetails.timestamp;
    // check time difference
    var diff_sec = moment().diff(moment.unix(timestamp_challenge), 'seconds');
    if (diff_sec > 300) {
      console.log("Challenge expired");
      return res.status(401).send({ message: "The challenge must have been generated within the last 5 minutes" });
    }
    const signerAddress = recoverPersonalSignature({
      data: bufferToHex(Buffer.from(getRandomNonceMessage(nonce), 'utf8')),
      signature: signature,
    });
    console.log('Expected address:', address);
    console.log('Signer address:', signerAddress.toLowerCase());
    if (address !== signerAddress.toLowerCase()) {
      console.log("Invalid signature");
      return res.status(401).send({ message: "Invalid Signature" });
    }
    var token = jwt.sign({ id: user._id }, config.secret, {
      expiresIn: 86400 // 24 hours
    });
    console.log("Generated token:", token);
    res.status(200).send({
      address: user.address,
      accessToken: token
    });
  } catch (error) {
    console.log("Error in auth_verify:", error);
    res.status(500).send({ message: error.message });
  }
};

