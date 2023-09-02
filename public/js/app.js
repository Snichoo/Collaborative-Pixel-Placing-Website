const ETHEREUM_MAINNET_NETWORK_ID = "1";
const API_URL = "http://localhost:8080";

class Dapp {
  constructor() {
    this.initialState = {
      selectedAddress: undefined,
      balance: undefined,
      networkError: undefined,
      loggedIn: false,
      loading: false,
      authorisedData: "",
    };
    this.state = this.initialState;
  }

  init() {
    this.render();
  }

  render() {
    if (window.ethereum === undefined) {
      this.renderNoWalletDetected();
      return;
    }
    if (!this.state.selectedAddress) {
      this.renderConnectWallet();
      return;
    }
    if (this.state.loading) {
      this.loading();
      return;
    }
    if (this.state.loggedIn) {
      this.renderLoggedIn();
    } else {
      this.renderConnectWallet();
    }
  }

  renderNoWalletDetected() {
    const root = document.getElementById("root");
    root.innerHTML = this.noWalletDetected();
  }

  renderConnectWallet() {
    const root = document.getElementById("root");
    root.innerHTML = this.connectWallet();
    const connectWalletButton = document.getElementById(
      "connect-wallet-button"
    );
    connectWalletButton.addEventListener("click", async () => {
      await this._connectWallet();
      this._login();
    });
  }

  renderLoggedIn() {
    const root = document.getElementById("root");
    root.innerHTML = this.loggedIn();
    const getDataButton = document.getElementById("get-data-button");
    getDataButton.addEventListener("click", () => {
      this._getAuthorisedData();
    });
  }

  noWalletDetected() {
    return `
      <div class="container">
        <div class="row justify-content-md-center">
          <div class="col-6 p-4 text-center">
            <p>
              No Ethereum wallet was detected. <br />
              Please install
              <a
                href="http://metamask.io"
                target="_blank"
                rel="noopener noreferrer"
              >
                MetaMask
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    `;
  }

  connectWallet() {
    return `
      <div class="container">
        <div class="row justify-content-md-center">
          <div class="col-6 p-4 text-center">
            <p>Please connect to your wallet and sign in.</p>
            <button
              class="btn btn-warning"
              type="button"
              id="connect-wallet-button"
            >
              Connect Wallet & Sign In
            </button>
          </div>
        </div>
      </div>
    `;
  }

  loading() {
    return `
      <div
        style="
          position: fixed;
          z-index: 2;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(255, 255, 255, 0.5);
        "
      >
        <div
          style="
            position: absolute;
            z-index: 3;
            top: 50%;
            left: 50%;
            width: 100px;
            height: 50px;
            margin-left: -50px;
            margin-top: -25px;
            text-align: center;
          "
        >
          <div class="spinner-border" role="status">
            <span class="sr-only">Loading...</span>
          </div>
        </div>
      </div>
    `;
  }

  loggedIn() {
    return `
      <div class="container p-4">
        <div class="row">
          <div class="col-12">
            <h1>Welcome</h1>
            <p>JWT TOKEN: ${window.localStorage.getItem("TOKEN")}</p>
            <button
              class="btn btn-warning"
              type="button"
              id="get-data-button"
            >
              Get Data
            </button>
          </div>
        </div>
      </div>
    `;
  }

  async _getAuthorisedData() {
    this.setState({
      loading: true,
    });
    const res = await fetch(`${API_URL}/api/test/user`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-access-token": window.localStorage.getItem("TOKEN"),
      },
    });
    const content = await res.json();
    console.log(content.message);
    this.setState({
      loading: false,
      authorisedData: content.message,
    });
    this.render();
  }

  async _login() {
    this.setState({
      loading: true,
    });
    const authChallengeRes = await fetch(`${API_URL}/api/auth/authChallenge`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ address: this.state.selectedAddress }),
    });
    const contentAuthChallenge = await authChallengeRes.json();
    const message = contentAuthChallenge.message;

    try {
      const from = this.state.selectedAddress;
      const textEncoder = new TextEncoder();
      const msg = `0x${Array.from(textEncoder.encode(message))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")}`;

      const sign = await window.ethereum.request({
        method: "personal_sign",
        params: [msg, from, ""],
      });
      console.log("OK SIGNED");

      const authVerifyRes = await fetch(`${API_URL}/api/auth/auth_verify`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address: this.state.selectedAddress,
          signature: sign,
        }),
      });

      if (authVerifyRes.status !== 200) {
        console.log("Error in auth_verify response:", await authVerifyRes.text());
        throw new Error("Error in auth_verify response");
      }

      const contentAuthVerify = await authVerifyRes.json();
      const token = contentAuthVerify.accessToken;
      window.localStorage.setItem("TOKEN", token);
      console.log("Newly fetched JWT Token:", token);
      console.log(window.localStorage.getItem("TOKEN"));
      console.log("Generated JWT token:", token);

      this.setState({
        loggedIn: true,
        loading: false,
      });

      this.render();
    } catch (err) {
      console.error(err);
      this.setState(
        {
          loggedIn: false,
          loading: false,
          selectedAddress: this.state.selectedAddress,
        },
        () => this.renderConnectWallet()
      );
    }
  }

  async _connectWallet() {
    const [selectedAddress] = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    if (!this._checkNetwork()) {
      return;
    }

    this._initialize(selectedAddress);

    window.ethereum.on("accountsChanged", ([newAddress]) => {
      this._stopPollingData();
      if (newAddress === undefined) {
        return this._resetState();
      }
      this._initialize(newAddress);
    });

    window.ethereum.on("chainChanged", ([networkId]) => {
      this._stopPollingData();
      this._resetState();
    });
  }

  _initialize(userAddress) {
    this.setState({
      selectedAddress: userAddress,
    });
    this._initializeEthers();
  }

  async _initializeEthers() {
    this._provider = new ethers.providers.Web3Provider(window.ethereum);
  }

  _dismissNetworkError() {
    this.setState({ networkError: undefined });
  }

  _getRpcErrorMessage(error) {
    if (error.data) {
      return error.data.message;
    }
    return error.message;
  }

  _resetState() {
    this.setState(this.initialState);
  }

  _checkNetwork() {
    if (window.ethereum.networkVersion === ETHEREUM_MAINNET_NETWORK_ID) {
      return true;
    }
    this.setState({
      networkError: "Please connect Metamask to Localhost:8545",
    });
    return false;
  }

  setState(newState) {
    this.state = { ...this.state, ...newState };
  }
}

const dapp = new Dapp();
dapp.init();
