const express = require("express");
const mongoose = require("mongoose");
const uid2 = require("uid2");
const SHA256 = require("crypto-js/sha256");
const encBase64 = require("crypto-js/enc-base64");
const fileUpload = require("express-fileupload");
const cloudinary = require("cloudinary").v2;
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
app.use(cors());

app.use(express.json());

mongoose.connect(process.env.MONGODB_URI);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_KEY,
});

const isAuthenticated = async (req, res, next) => {
  console.log("hi");
  try {
    if (!req.headers.authorization) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = req.headers.authorization.replace("Bearer ", "");
    // console.log(token);
    const user = await User.findOne({ token: token }).select("account");
    // console.log(user);

    if (user === null) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const User = mongoose.model("User", {
  email: String,
  account: {
    username: String,
    // avatar: Object,
  },
  newsletter: Boolean,
  token: String,
  hash: String,
  salt: String,
});

const Offer = mongoose.model("Offer", {
  product_name: String,
  product_description: String,
  product_price: Number,
  product_details: Array,
  product_image: Object,
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
});

app.post("/users/signup", isAuthenticated, async (req, res) => {
  try {
    if (!req.body.username || !req.body.email || !req.body.password) {
      return res.status(400).json("Missing parameters");
    }
    const existingUser = await User.findOne({ email: req.body.email });
    if (!existingUser) {
      const salt = uid2(16);
      const hash = SHA256(req.body.password + salt).toString(encBase64);
      const token = uid2(64);
      // console.log(token);

      const newUser = new User({
        email: req.body.email,
        account: {
          username: req.body.username,
        },
        newsletter: req.body.newletter,
        token: token,
        hash: hash,
        salt: salt,
      });

      await newUser.save();

      const responseObject = {
        _id: newUser._id,
        token: newUser.token,
        account: {
          username: newUser.account.username,
        },
      };

      return res.status(201).json(responseObject);
    } else {
      return res.status(409).json("cet email est déjà utilisé");
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

const convertToBase64 = (file) => {
  return `data:${file.mimetype};base64,${file.data.toString("base64")}`;
};

app.post("/users/login", async (req, res) => {
  try {
    const userToFind = await User.findOne({ email: req.body.email });
    // console.log(userToFind);
    // const hash2 = SHA256(req.body.password + User.salt).toString(encBase64);
    if (!userToFind) {
      return res.status(401).json("Email ou password incorrect");
    }

    const newHash = SHA256(req.body.password + userToFind.salt).toString(
      encBase64
    );
    if (newHash === userToFind.hash) {
      const responseObject = {
        _id: userToFind._id,
        token: userToFind.token,
        account: {
          username: userToFind.account.username,
        },
      };
      return res.status(200).json(responseObject);
    } else {
      res.status(401).json("Email ou password incorrect");
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/offer/publish", isAuthenticated, fileUpload(), async (req, res) => {
  try {
    const { description, price, condition, city, brand, size, color, title } =
      req.body;
    const picture = req.files.picture;

    const cloudinaryResponse = await cloudinary.uploader.upload(
      convertToBase64(picture)
    );
    //   console.log(cloudinaryResponse);

    const newOffer = new Offer({
      product_name: title,
      product_description: description,
      product_price: price,
      product_details: [
        {
          MARQUE: brand,
        },
        {
          TAILLE: size,
        },
        {
          ÉTAT: condition,
        },
        {
          COULEUR: color,
        },
        {
          EMPLACEMENT: city,
        },
      ],
      product_image: cloudinaryResponse,
      owner: req.user,
    });

    await newOffer.save();

    //   await newOffer.populate("owner", "account");

    res.status(201).json(newOffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
app.get("/offers", async (req, res) => {
  try {
    const offers = await Offer.find({
      product_name: new RegExp("pantalon", "i"),
      product_price: { $gte: 500, $lte: 1000 },
    })
      .sort({ product_price: "asc" })
      .skip(0)
      .limit(10)
      .select("product_price product_name");

    res.json(offers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.all("*", (req, res) => {
  res.status(500).json({ message: "This route does not exist" });
});

app.listen(process.env.PORT, () => {
  console.log("Server started");
});
