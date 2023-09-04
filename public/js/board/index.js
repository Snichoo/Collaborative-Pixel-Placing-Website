let pixelArray;
const coordElement = document.getElementById("pixel");
const ownerElement = document.getElementById("owner");
const chatInput = document.getElementById("chatInput");
const messages = document.getElementById("messages");
let mouseDownTime;
let mouseUpTime;

const colors = {
  1: "#6d001a",
  2: "#be0039",
  3: "#ff4500",
  4: "#ffa800",
  5: "#ffd635",
  6: "#fff8b8",
  7: "#00a368",
  8: "#00cc78",
  9: "#7eed56",
  10: "#00756f",
  11: "#009eaa",
  12: "#00ccc0",
  13: "#2450a4",
  14: "#3690ea",
  15: "#51e9f4",
  16: "#493ac1",
  17: "#6a5cff",
  18: "#94b3ff",
  19: "#811e9f",
  20: "#b44ac0",
  21: "#e4abff",
  22: "#de107f",
  23: "#ff3881",
  24: "#ff99aa",
  25: "#6d482f",
  26: "#9c6926",
  27: "#ffb470",
  28: "#000000",
  29: "#515252",
  30: "#898d90",
  31: "#d4d7d9",
  32: "#ffffff",
};

let selectedColor;
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

function renderPixels(pixelArray) {
  for (let y = 0; y < pixelArray.length; y += 1) {
    for (let x = 0; x < pixelArray[y].length; x += 1) {
      if (pixelArray[y][x] != 32) {
        ctx.fillStyle = colors[pixelArray[y][x]];
        ctx.fillRect(x * 10, y * 10, 10, 10);
      }
    }
  }
}

function renderPixel(x, y, color) {
  ctx.fillStyle = colors[color];
  ctx.fillRect(x * 10, y * 10, 10, 10);
}

function updateColor(event) {
  selectedColor = event.target.getAttribute("color");
  new Audio("audio/Select Color.mp3").play();
}

const socket = io();
socket.on("pixelUpdate", function (event) {
  pixelArray = event.pixelArray;
  renderPixel(event.x, event.y, event.color);
});

socket.on("canvasUpdate", function (event) {
  pixelArray = event.pixelArray;
  renderPixels(event.pixelArray);
});

socket.on("chat", function (msg) {
  const newMsg = document.createElement("p");
  messages.appendChild(newMsg);
  newMsg.innerHTML = msg;
});

function handle(e) {
  if (e.keyCode === 13) {
    socket.emit("chat", chatInput.value);
    chatInput.value = "";
    return false;
  }
}

function placePixel(x, y) {
  fetch("/placepixel", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      walletAddress: walletAddress, // Pass the walletAddress here
      selectedX: x,
      selectedY: y,
      selectedColor: selectedColor,
    }),
  }).then((response) => {
    if (response.status == 200) {
      new Audio("audio/Pixel Placed.mp3").play();
    }
  });
}

let lastX, lastY;


function renderPreviewPixel(x, y, color) {
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.5; // To make the preview pixel translucent
  ctx.fillRect(x * 10, y * 10, 10, 10);
  ctx.globalAlpha = 1; // Reset the alpha value to default
}

canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  let x = event.clientX - rect.left;
  let y = event.clientY - rect.top;

  x = Math.floor(x / zoom);
  y = Math.floor(y / zoom);

  x = Math.floor(x / 10);
  y = Math.floor(y / 10);

  // Clear the previous preview pixel and redraw that pixel from pixelArray if set
  if (lastX !== undefined && lastY !== undefined) {
    ctx.clearRect(lastX * 10, lastY * 10, 10, 10);
    if (pixelArray[lastY] && pixelArray[lastY][lastX] !== 32) {  // Add pixelArray[lastY] check for safety
      renderPixel(lastX, lastY, pixelArray[lastY][lastX]);
    }
  }

  // Draw the preview pixel only if the cursor is within the canvas bounds
  if (selectedColor && x >= 0 && x < pixelArray[0].length && y >= 0 && y < pixelArray.length) {
    renderPixel(x, y, selectedColor);
  } else if (y >= pixelArray.length) {  // This checks if the cursor is outside the canvas at the bottom side
    // Redraw the entire canvas to remove the preview pixel if the cursor goes beyond the bottom edge
    renderPixels(pixelArray);
  }

  // Update last cursor position
  lastX = x;
  lastY = y;
});

canvas.addEventListener("mouseleave", () => {
  // Redraw the entire canvas to remove the preview pixel
  renderPixels(pixelArray);
});


canvas.addEventListener("click", (event) => {
  const rect = canvas.getBoundingClientRect();
  
  // Calculate the x and y positions without translations and zoom
  let x = event.clientX - rect.left;
  let y = event.clientY - rect.top;

  // Adjust the x and y positions based on the zoom level
  x = Math.floor(x / zoom);
  y = Math.floor(y / zoom);

  // Round to the nearest pixel location
  x = Math.floor(x / 10);
  y = Math.floor(y / 10);

  // Check if the shift key is pressed during the click
  if (event.shiftKey) {
    fetch('/getwallet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ x, y }),
    })
    .then(response => response.json())
    .then(data => {
      if (data.walletAddress) {
        let displayAddress = data.walletAddress;
        if (displayAddress.length > 15) {
          displayAddress = displayAddress.substring(0, 6) + "..." + displayAddress.substring(displayAddress.length - 6);
        }
        ownerElement.innerText = `Wallet Address: ${displayAddress}`;
        ownerElement.title = data.walletAddress;  // full address as a tooltip
      } else {
        ownerElement.innerText = "Unknown Address";
      }
    })    
    .catch(error => {
      console.error('Error fetching wallet address:', error);
      ownerElement.innerText = "Error fetching address";
    });

  } else {
    // The logic for placing a pixel (existing click event logic)
    const timeDifference = mouseUpTime - mouseDownTime;
    // Only proceed if the difference is less than 150 milliseconds
    if (timeDifference > 150) {
      return;
    }
    
    if (selectedColor && x >= 0 && x < pixelArray[0].length && y >= 0 && y < pixelArray.length) {
      placePixel(x, y);
    }
  }
});

