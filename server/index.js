const express = require("express");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const User = require("./models/user");
const Place = require("./models/place");
const Booking = require("./models/booking");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const imageDownloader = require("image-downloader");
const {S3Client,PutObjectCommand} = require('@aws-sdk/client-s3')
const multer = require('multer')
const fs = require('fs')
const mime = require('mime-types')

dotenv.config();
mongoose.connect(process.env.MONGO_URL);

const app = express();

const bcryptSalt = bcrypt.genSaltSync(10);
const jwtSecret = "fasefraw4r5r3wq45wdfgw34twdfg";
const bucket = 'amrit-booking-bucket'

app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(__dirname + "/uploads"));
app.use(
  cors({
    credentials: true,
    origin: "http://127.0.0.1:5173",
  })
);

// upload to aws
const uploadToS3 = async(path,originalFilename,mimetype) => {
   const client = new S3Client({
    region:'eu-north-1',
    credentials: {
        accessKeyId:process.env.S3_ACCESS_KEY,
        secretAccessKey:process.env.S3_SECRET_ACCESS_KEY
    }
   })
   const parts = originalFilename.split('.')
   const ext = parts[parts.length - 1]
   const newFilename = Date.now() + '.' + ext;
   const data = await client.send(new PutObjectCommand({
    Bucket: bucket,
    Body: fs.readFileSync(path),
    Key: newFilename,
    ContentType: mimetype,
    ACL: 'public-read'
   }))
   return `https://${bucket}.s3.amazonaws.com/${newFilename}`
}

// helper function
function getUserDataFromReq(req) {
  return new Promise((resolve, reject) => {
    jwt.verify(req.cookies.token, jwtSecret, {}, async (err, userData) => {
      if (err) throw err;
      resolve(userData);
    });
  });
}

// routes
app.get("/", (req, res) => {
  res.json("server is up and running");
});

// register
app.post("/register", async (req, res) => {
mongoose.connect(process.env.MONGO_URL);
  const { username, email, password } = req.body;

  try {
    const userDoc = await User.create({
      username,
      email,
      password: bcrypt.hashSync(password, bcryptSalt),
    });
    res.json(userDoc);
  } catch (e) {
    res.status(422).json(e);
  }
});

//   login
app.post("/login", async (req, res) => {
mongoose.connect(process.env.MONGO_URL);
  const { email, password } = req.body;
  const userDoc = await User.findOne({ email });
  if (userDoc) {
    const passOk = bcrypt.compareSync(password, userDoc.password);
    if (passOk) {
      jwt.sign(
        {
          email: userDoc.email,
          id: userDoc._id,
        },
        jwtSecret,
        {},
        (err, token) => {
          if (err) throw err;
          res.cookie("token", token).json(userDoc);
        }
      );
    } else {
      res.status(422).json("incorrect password");
    }
  } else {
    res.json("not found");
  }
});

//   profile if user exist
app.get("/profile", (req, res) => {
mongoose.connect(process.env.MONGO_URL);
  const { token } = req.cookies;
  if (token) {
    jwt.verify(token, jwtSecret, {}, async (err, userData) => {
      if (err) throw err;
      const { username, email, _id } = await User.findById(userData.id);
      res.json({ username, email, _id });
    });
  } else {
    res.json(null);
  }
});

//   logout
app.post("/logout", (req, res) => {
  res.cookie("token", "").json(true);
});

//   upload image by link
app.post("/upload-by-link", async (req, res) => {
mongoose.connect(process.env.MONGO_URL);
  const { link } = req.body;
  const newName = "photo" + Date.now() + ".jpg";
  await imageDownloader.image({
    url: link,
    dest: '/tmp/' + newName,
  });
  const url = await uploadToS3('/tmp/' + newName,newName, mime.lookup('/tmp/' + newName))
  res.json(url);
});

// upload from device to aws
const photoMiddleware = multer({dest:'/tmp'})
mongoose.connect(process.env.MONGO_URL);
app.post('/upload',photoMiddleware.array('photos',100),async(req,res) => {
    const uploadedFiles = []
    for (let i = 0; i < req.files.length; i++) {
        const {path,originalname,mimetype} = req.files[i]
        const url = await uploadToS3(path,originalname,mimetype)
        uploadedFiles.push(url)
        
    }
    res.json(uploadedFiles)
})

//   place page
app.post("/places", (req, res) => {
mongoose.connect(process.env.MONGO_URL);
  const { token } = req.cookies;
  const {
    title,
    address,
    addedPhoto,
    description,
    price,
    perks,
    extraInfo,
    checkIn,
    checkOut,
    maxGuests,
  } = req.body;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) throw err;
    const placeDoc = await Place.create({
      owner: userData.id,
      price,
      title,
      address,
      photos: addedPhoto,
      description,
      perks,
      extraInfo,
      checkIn,
      checkOut,
      maxGuests,
    });
    res.json(placeDoc);
  });
});

//   user place page
app.get("/user-places", (req, res) => {
mongoose.connect(process.env.MONGO_URL);
  const { token } = req.cookies;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    const { id } = userData;
    res.json(await Place.find({ owner: id }));
  });
});

//   single place place
app.get("/places/:id", async (req, res) => {
mongoose.connect(process.env.MONGO_URL);
  const { id } = req.params;
  res.json(await Place.findById(id));
});

//   editing place page
app.put("/places", async (req, res) => {
mongoose.connect(process.env.MONGO_URL);
  const { token } = req.cookies;
  const {
    id,
    title,
    address,
    addedPhoto,
    description,
    perks,
    extraInfo,
    checkIn,
    checkOut,
    maxGuests,
    price,
  } = req.body;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) throw err;
    const placeDoc = await Place.findById(id);
    if (userData.id === placeDoc.owner.toString()) {
      placeDoc.set({
        title,
        address,
        photos: addedPhoto,
        description,
        perks,
        extraInfo,
        checkIn,
        checkOut,
        maxGuests,
        price,
      });
      await placeDoc.save();
      res.json("ok");
    }
  });
});

//   All places page (home page )
app.get("/places", async (req, res) => {
mongoose.connect(process.env.MONGO_URL);
  res.json(await Place.find());
});

//   booking page
app.post("/bookings", async (req, res) => {
mongoose.connect(process.env.MONGO_URL);
  const userData = await getUserDataFromReq(req);
  const { place, checkIn, checkOut, numberOfGuests, name, phone, price } =
    req.body;
  Booking.create({
    place,
    checkIn,
    checkOut,
    numberOfGuests,
    name,
    phone,
    price,
    user: userData.id,
  })
    .then((doc) => {
      res.json(doc);
    })
    .catch((err) => {
      throw err;
    });
});

//   single booking page
app.get("/bookings", async (req, res) => {
mongoose.connect(process.env.MONGO_URL);
  const userData = await getUserDataFromReq(req);
  res.json(await Booking.find({ user: userData.id }).populate("place"));
});

app.listen(4000);
