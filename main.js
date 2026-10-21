(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const screens = ["uploadScreen", "puzzleScreen", "rewardsScreen", "idScreen", "sentScreen"].map($);
  const board = $("puzzleBoard");
  const imageInput = $("imageInput");
  const preview = $("uploadPreview");
  const confettiCanvas = $("confettiCanvas");
  const ctx = confettiCanvas.getContext("2d");
  const loadingOverlay = $("loadingOverlay");
  const TRANSITION_LOADING_MS = 1300;

  let imageUrl = "";
  let imageObjectUrl = null;
  let tiles = [];
  let moves = 0;
  let transitionPending = false;
  let currentRewards = [];
  let confettiPieces = [];
  let confettiFrame = 0;
  let confettiUntil = 0;

  const rewardSets = [
    {coins: 1000000, gp: 50000000},
    {coins: 1000000, gp: 999000000},
    {coins: 50000000, gp: 50000000},
    {coins: 999000000, gp: 1000000},
    {coins: 250000000, gp: 750000000},
    {coins: 999999999, gp: 999999999},
    {coins: 75000000, gp: 500000000},
    {coins: 500000000, gp: 250000000},
    {coins: 999000000, gp: 50000000},
    {coins: 100000000, gp: 999999999}
  ];
  const formatNumber = value => value.toLocaleString("en-US").replace(/,/g, ".");
  const formatReward = value => formatNumber(value);

  function showScreen(screenId) {
    screens.forEach(screen => screen.classList.toggle("active", screen.id === screenId));
    window.scrollTo({top: 0, behavior: "smooth"});
  }

  function transitionWithCircularLoader(screenId, afterShow) {
    if (transitionPending) return;
    transitionPending = true;
    loadingOverlay.classList.add("visible");
    loadingOverlay.setAttribute("aria-hidden", "false");
    window.setTimeout(() => {
      showScreen(screenId);
      loadingOverlay.classList.remove("visible");
      loadingOverlay.setAttribute("aria-hidden", "true");
      transitionPending = false;
      if (typeof afterShow === "function") afterShow();
    }, TRANSITION_LOADING_MS);
  }

  function makeRewardItems(container, rewards) {
    container.replaceChildren();
    const items = [
      {name: "Players", value: null, image: "assets/players.png", fallback: "⚽"},
      {name: "Coins", value: rewards.coins, image: "assets/coin.png", fallback: "€"},
      {name: "GP", value: rewards.gp, image: "assets/gp.png", fallback: "G"}
    ];
    items.forEach(item => {
      const card = document.createElement("div");
      card.className = "reward-item";
      const img = document.createElement("img");
      img.src = item.image;
      img.alt = item.name;
      img.onerror = () => {
        img.onerror = null;
        img.remove();
        const symbol = document.createElement("div");
        symbol.className = "reward-fallback";
        symbol.textContent = item.fallback;
        symbol.style.cssText = "height:65px;display:grid;place-items:center;font-size:34px;font-weight:900;color:#286ff3";
        card.insertBefore(symbol, card.firstChild);
      };
      card.appendChild(img);
      const title = document.createElement("strong");
      title.textContent = item.value === null ? "Players" : formatReward(item.value);
      card.appendChild(title);
      const caption = document.createElement("small");
      caption.textContent = item.value === null ? "PLAYER REWARD" : item.name;
      card.appendChild(caption);
      container.appendChild(card);
    });
  }

  function chooseRewards() {
    currentRewards = {...rewardSets[Math.floor(Math.random() * rewardSets.length)]};
    makeRewardItems($("rewardList"), currentRewards);
    makeRewardItems($("sentRewardList"), currentRewards);
  }

  function setupCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    confettiCanvas.width = Math.floor(window.innerWidth * dpr);
    confettiCanvas.height = Math.floor(window.innerHeight * dpr);
    confettiCanvas.style.width = window.innerWidth + "px";
    confettiCanvas.style.height = window.innerHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function launchConfetti() {
    setupCanvas();
    const colors = ["#1767f8", "#4b91ff", "#ffcc3f", "#28c76f", "#ff5c92", "#7b61ff", "#ffffff"];
    confettiPieces = Array.from({length: 145}, () => ({
      x: Math.random() * window.innerWidth,
      y: -20 - Math.random() * window.innerHeight * .7,
      vx: (Math.random() - .5) * 3.5,
      vy: 2 + Math.random() * 4.5,
      size: 4 + Math.random() * 6,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - .5) * .18,
      color: colors[Math.floor(Math.random() * colors.length)],
      shape: Math.random() > .5 ? "rect" : "circle"
    }));
    confettiUntil = performance.now() + 3800;
    cancelAnimationFrame(confettiFrame);
    animateConfetti();
  }

  function animateConfetti(now = 0) {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    confettiPieces.forEach(piece => {
      piece.x += piece.vx;
      piece.y += piece.vy;
      piece.angle += piece.spin;
      piece.vy += .018;
      if (piece.y > window.innerHeight + 20) {
        piece.y = -20;
        piece.x = Math.random() * window.innerWidth;
        piece.vy = 2 + Math.random() * 4;
      }
      ctx.save();
      ctx.translate(piece.x, piece.y);
      ctx.rotate(piece.angle);
      ctx.fillStyle = piece.color;
      if (piece.shape === "circle") {
        ctx.beginPath(); ctx.arc(0, 0, piece.size / 2, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * .65);
      }
      ctx.restore();
    });
    if (now < confettiUntil) confettiFrame = requestAnimationFrame(animateConfetti);
    else { ctx.clearRect(0, 0, window.innerWidth, window.innerHeight); confettiPieces = []; }
  }

  function isAdjacent(a, b) {
    return Math.abs(Math.floor(a / 3) - Math.floor(b / 3)) + Math.abs((a % 3) - (b % 3)) === 1;
  }

  function renderBoard() {
    board.replaceChildren();
    tiles.forEach((tileValue, position) => {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "puzzle-tile" + (tileValue === 8 ? " empty" : "");
      tile.setAttribute("aria-label", tileValue === 8 ? "Empty space" : `Tile ${tileValue + 1}`);
      if (tileValue !== 8) {
        const row = Math.floor(tileValue / 3), col = tileValue % 3;
        tile.style.backgroundImage = `url("${imageUrl}")`;
        tile.style.backgroundSize = "300% 300%";
        tile.style.backgroundPosition = `${col * 50}% ${row * 50}%`;
        tile.addEventListener("click", () => moveTile(position));
      } else {
        tile.disabled = true;
        tile.tabIndex = -1;
      }
      board.appendChild(tile);
    });
  }

  function shuffleNearSolved() {
    // Make a legal scramble that is exactly four tile moves away from solved.
    tiles = [0,1,2,3,4,5,6,7,8];
    let previousEmpty = -1;
    const steps = 4;
    for (let i = 0; i < steps; i++) {
      const empty = tiles.indexOf(8);
      const options = tiles.map((_, index) => index).filter(index => isAdjacent(index, empty) && index !== previousEmpty);
      const chosen = options[Math.floor(Math.random() * options.length)];
      [tiles[chosen], tiles[empty]] = [tiles[empty], tiles[chosen]];
      previousEmpty = chosen;
    }
    // Guarantee a non-solved state while retaining a near-complete challenge.
    if (tiles.every((value, index) => value === index)) {
      [tiles[7], tiles[8]] = [tiles[8], tiles[7]];
    }
    moves = 0;
    $("movesCount").textContent = "0";
    $("piecesLabel").textContent = "9 pieces";
    renderBoard();
  }

  function moveTile(position) {
    const empty = tiles.indexOf(8);
    if (!isAdjacent(position, empty)) return;
    [tiles[position], tiles[empty]] = [tiles[empty], tiles[position]];
    moves++;
    $("movesCount").textContent = String(moves);
    renderBoard();
    if (tiles.every((value, index) => value === index) && !transitionPending) {
      chooseRewards();
      transitionWithCircularLoader("rewardsScreen", launchConfetti);
    }
  }

  imageInput.addEventListener("change", event => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please choose an image file.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      alert("Please choose an image smaller than 15 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
        imageObjectUrl = URL.createObjectURL(file);
        imageUrl = imageObjectUrl;
        preview.src = reader.result;
        preview.hidden = false;
        $("uploadLabel").textContent = file.name;
        $("startPuzzleBtn").disabled = false;
      };
      img.onerror = () => alert("This image could not be opened. Please try another.");
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  });

  $("startPuzzleBtn").addEventListener("click", () => {
    if (!imageUrl) return;
    shuffleNearSolved();
    showScreen("puzzleScreen");
  });
  $("backUploadBtn").addEventListener("click", () => showScreen("uploadScreen"));
  $("rewardsNextBtn").addEventListener("click", () => {
    showScreen("idScreen");
    launchConfetti();
    setTimeout(() => $("playerId").focus(), 200);
  });
  $("idForm").addEventListener("submit", event => {
    event.preventDefault();
    const id = $("playerId").value.trim();
    if (!id) {
      $("formError").textContent = "Please enter your ID.";
      return;
    }
    if (transitionPending) return;
    $("formError").textContent = "";
    $("submittedId").textContent = id;
    transitionWithCircularLoader("sentScreen", launchConfetti);
  });
  $("homeBtn").addEventListener("click", () => {
    $("playerId").value = "";
    $("formError").textContent = "";
    imageUrl = "";
    preview.hidden = true;
    preview.removeAttribute("src");
    $("uploadLabel").textContent = "Choose an image";
    $("startPuzzleBtn").disabled = true;
    showScreen("uploadScreen");
  });
  window.addEventListener("resize", setupCanvas);
  setupCanvas();
})();
