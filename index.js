const { exec } = require("child_process");
const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const app = express();
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.json());
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const cookieParser = require('cookie-parser');
app.use(cookieParser());

// MongoDB
const { MongoClient, ServerApiVersion } = require("mongodb");
const client = new MongoClient(process.env["MONGO_URI"], {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});
const client2 = new MongoClient(process.env["MONGO_URI2"], {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

let pixelArray, boardCollection;
const usersCollection = client.db(process.env["DATABASE"]).collection("users");
const placedCollection = client2.db(process.env["DATABASE"]).collection("placed");

const allowedUsers = [];

client.connect(async (err) => {
  if (err) {
    console.log(err);
    exec("kill 1");
    process.exit(1);
  }

  boardCollection = client.db(process.env["DATABASE"]).collection("pixels");

  const board = await boardCollection.findOne({ _id: "latestBoard" });
  try {
    pixelArray = board.pixelArray;
  } catch (err) {
    pixelArray = Array(50).fill(Array(50).fill(32));
    await boardCollection.updateOne(
      { _id: "latestBoard" },
      { $set: { _id: "latestBoard", pixelArray } },
      { upsert: true }
    );
  }
});

client2.connect();


const renderIndex = (req, res) => {
  if (!pixelArray) {
    // Retry render in 3s
    return setTimeout(() => {
      renderIndex(req, res);
    }, 3000);
  }

  res.render("board", {
    googleClientId: process.env["GOOGLE_CLIENT_ID"],
    canvasHeight: pixelArray.length * 10,
    canvasWidth: pixelArray[0].length * 10,
  });
};

app.get("/", renderIndex);

app.post("/", async (req, res) => {
  const walletAddress = req.body.walletAddress;
  
  const user = await usersCollection.findOne({ _id: walletAddress });
  let cooldown;
  
  if (user) {
    cooldown = user.cooldown;
  } else {
    cooldown = Date.now();
    usersCollection.updateOne(
      { _id: walletAddress },
      {
        $setOnInsert: {
          name: walletAddress,
          ip: req.header("x-forwarded-for")
        },
        $set: { cooldown: Date.now() }
      },
      { upsert: true }
    );    
  }
  
  res.cookie('walletAddress', walletAddress, { httpOnly: true, secure: true, maxAge: 3600000 }); // 1 hour expiration


  res.send({ cooldown: cooldown });
});

app.post("/placepixel", async (req, res) => {
  let walletAddress = req.cookies.walletAddress; // <-- Fetch the wallet address from the cookie
  console.log("Wallet Address:", walletAddress);

  const user = await usersCollection.findOne({ _id: walletAddress });
  console.log("User fetched from database:", user);
  let cooldown;

  if (user) {
    cooldown = user.cooldown;
  } else {
    return res.status(405).send("Not a registered user!");
  }

  if (cooldown < Date.now()) {
    try {
      pixelArray[req.body.selectedY][req.body.selectedX] = parseInt(
        req.body.selectedColor,
        10
      );
    } catch (err) {
      return res.sendStatus(403);
    }

    io.emit("pixelUpdate", {
      x: req.body.selectedX,
      y: req.body.selectedY,
      color: req.body.selectedColor,
      pixelArray: pixelArray,
      u: user._id,
    });

    const cooldown = allowedUsers.includes(user.name) ? 10 : Date.now() + 8000;
    res.send({ cooldown: cooldown });

    await usersCollection.updateOne(
      { _id: walletAddress },
      { $set: { cooldown: cooldown } }
    );

    let _id = `${req.body.selectedX}${req.body.selectedY}`;
    const pixel = await placedCollection.findOne({ _id });
    if (!pixel) {
      placedCollection.insertOne({
        _id,
        p: [{ c: req.body.selectedColor, u: user._id }],
      });
    } else {
      placedCollection.updateOne(
        { _id },
        { $push: { p: { c: req.body.selectedColor, u: user._id } } }
      );
    }
  } else {
    return res.status(403).send({ cooldown: cooldown });
  }
});

app.get("/about", (req, res) => {
  res.redirect("https://en.wikipedia.org/wiki/R/place");
});

app.post("/user", async (req, res) => {
  const user = await usersCollection.findOne({ _id: req.body.id });

  res.json({ name: user.name, picture: user.picture });
});

app.post("/pixel", async (req, res) => {
  const pixel = await placedCollection.findOne({
    _id: `${req.body.x}${req.body.y}`,
  });

  if (!pixel) {
    return res.sendStatus(404);
  }

  res.json(pixel.p[pixel.p.length - 1]);
});

app.post("/getwallet", async (req, res) => {
  const x = req.body.x;
  const y = req.body.y;

  const pixel = await placedCollection.findOne({
    _id: `${x}${y}`
  });
  console.log(req.body);

  if (pixel) {
    const lastPlaced = pixel.p[pixel.p.length - 1];
    res.json({ walletAddress: lastPlaced.u });
  } else {
    res.status(404).send("Pixel not found");
  }
});


const sendPixelArray = (socket) => {
  if (typeof pixelArray !== "undefined") {
    if (socket) {
      socket.emit("canvasUpdate", { pixelArray: pixelArray });
    }
  } else {
    setTimeout(() => {
      sendPixelArray(socket);
    }, 250);
  }
};

io.on("connection", sendPixelArray);

setInterval(() => {
  if (pixelArray) {
    boardCollection.updateOne({ _id: "latestBoard" }, { $set: { pixelArray } });
  }
}, 5000);

server.listen(8080, () => {
  console.log("Listening on port 8080\nhttp://localhost:8080");
});
