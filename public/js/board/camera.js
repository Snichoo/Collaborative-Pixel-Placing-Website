const zoomElement = document.getElementById("zoom-container");
const board = document.getElementById("board");
let zoom = window.screen.availHeight / (canvas.height * 1.5);
zoomElement.style.transform = `scale(${zoom})`;
let dragging = false;
let currentX = 0;
let currentY = 0;
let initialX, initialY;


function zoom_camera(event) {
  const isTouchPad = event.wheelDeltaY
    ? event.wheelDeltaY === -3 * event.deltaY
    : event.deltaMode === 0;
  if (event.deltaY < 0) {
    if (zoom >= 7) return;
    zoomElement.style.transform = `scale(${(zoom += isTouchPad ? 0.1 : 0.5)})`;
  } else {
    if (zoom <= 1) return;
    zoomElement.style.transform = `scale(${(zoom -= isTouchPad ? 0.1 : 0.5)})`;
  }
}

function dragStart(e) {
  mouseDownTime = new Date().getTime(); // Add this line
  if (e.type === "touchmove") {
    x = e.touches[0].clientX;
    y = e.touches[0].clientY;
  } else {
    x = e.clientX;
    y = e.clientY;
  }
  initialX = x - currentX * zoom;
  initialY = y - currentY * zoom;
  dragging = true;
  board.classList.add("dragging");
}

function drag(e) {
  if (dragging) {
    e.preventDefault();
    if (e.type === "touchmove") {
      x = e.touches[0].clientX;
      y = e.touches[0].clientY;
    } else {
      x = e.clientX;
      y = e.clientY;
    }
    currentX = (x - initialX) / zoom;
    currentY = (y - initialY) / zoom;
    board.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
  }
}

function dragEnd(e) {
  mouseUpTime = new Date().getTime(); // Add this line
  dragging = false;
  board.classList.remove("dragging");
}

document.addEventListener("wheel", zoom_camera);
document.addEventListener("touchstart", dragStart);
document.addEventListener("touchend", dragEnd);
document.addEventListener("touchmove", drag);
document.addEventListener("mousedown", dragStart);
document.addEventListener("mouseup", dragEnd);
document.addEventListener("mousemove", drag);
