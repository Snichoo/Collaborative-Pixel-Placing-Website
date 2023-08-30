let walletAddress;

function handleCredentialResponse(credential) {
  console.log("Credential:", credential);
  walletAddress = credential.walletAddress;
  const colorElement = document.getElementById("colors");

  fetch(window.location.href, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      walletAddress: credential.walletAddress,
    }),
  }).then((response) => {
    if (response.status == 200) {
      colorElement.innerHTML = "";
      for (const color of Object.keys(colors)) {
        colorElement.innerHTML += `<input ${
          color == selectedColor ? 'checked=""' : ""
        } onchange="updateColor(event);" type="radio" name="color" style="background-color: ${
          colors[color]
        };" color="${color}"></div>`;
      }
      response.json().then((json) => {
        generateCountdown(placeButton, json.cooldown);
      });
    } else {
      response.text().then((json) => {
        displayErrorMessage(json.error);
      });
    }
  });
}
