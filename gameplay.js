// Game state management
const GAME_STATES = {
  START: 'start',
  PLAYING: 'playing',
  DEATH: 'death'
};

let gameState = GAME_STATES.START;
let gameInitialized = false;

// Health and Shield system
const BOAT_STATS = {
  MAX_HEALTH: 100,
  MAX_SHIELD: 100,
  STARTING_HEALTH: 100,
  STARTING_SHIELD: 10,
  PASSIVE_DAMAGE_INTERVAL: 60, // frames
  LAND_DAMAGE: 10,
  ROCK_DAMAGE: 2
};

// Damage effect parameters
const DAMAGE_EFFECTS = {
  // Red tint effect
  PASSIVE_TINT_ALPHA: 3,  // Light red tint for passive damage
  ROCK_TINT_ALPHA: 7,     // Medium red tint for rock collision
  LAND_TINT_ALPHA: 10,    // Strong red tint for land collision
  TINT_DURATION: 4,       // How long the tint effect lasts in frames
  
  // Screen shake effect
  ROCK_SHAKE_AMOUNT: 2,    // Small shake for rock collision
  LAND_SHAKE_AMOUNT: 3,   // Larger shake for land collision
  SHAKE_DURATION: 4,      // How long the shake effect lasts in frames
  SHAKE_FALLOFF: 0.7      // How quickly the shake effect decreases (lower = faster)
};

let boatHealth = BOAT_STATS.STARTING_HEALTH;
let boatShield = BOAT_STATS.STARTING_SHIELD;
let passiveDamageCounter = 0;

// Damage immunity system
let damageImmunity = {
  land: false,
  rock: false,
  lastLandCollision: false,
  lastRockCollision: false
};

// UI and display
let startScreenAlpha = 255;
let deathScreenAlpha = 0;

// Shop system
const SHOP_ITEMS = {
  HEALTH_POTION: {
    name: "Health Potion",
    description: "Restore 20 health",
    cost: 10,
    effect: () => {
      boatHealth = Math.min(BOAT_STATS.MAX_HEALTH, boatHealth + 20);
    }
  },
  SHIELD_DEVICE: {
    name: "Shield Device",
    description: "Restore 20 shield",
    cost: 15,
    effect: () => {
      boatShield = Math.min(BOAT_STATS.MAX_SHIELD, boatShield + 20);
    }
  },
  SPEED_BOOSTER: {
    name: "Speed Booster",
    description: "Increase speed by 2",
    cost: 50,
    maxPurchases: 5,
    purchased: 0,
    effect: () => {
      if (SHOP_ITEMS.SPEED_BOOSTER.purchased < SHOP_ITEMS.SPEED_BOOSTER.maxPurchases) {
        boat.speed += 2;
        SHOP_ITEMS.SPEED_BOOSTER.purchased++;
      }
    }
  }
};

let shopExpanded = false;
let shopWidth = 250;
let shopCollapsedWidth = 30;
let purchaseMessage = "";
let purchaseMessageTimer = 0;

let shopArrowArea = null;

function initializeGameplay() {
  // Reset all gameplay variables
  boatHealth = BOAT_STATS.STARTING_HEALTH;
  boatShield = BOAT_STATS.STARTING_SHIELD;
  passiveDamageCounter = 0;
  
  // Reset damage immunity
  damageImmunity = {
    land: false,
    rock: false,
    lastLandCollision: false,
    lastRockCollision: false
  };
  
  // Reset damage effects
  damageEffect = {
    tintAlpha: 0,
    tintDuration: 0,
    shakeAmount: 0,
    shakeDuration: 0
  };
  
  // Reset visual effects
  deathScreenAlpha = 0;
  
  // Reset boat position only if not already initialized (to prevent jarring reset on first start)
  if (gameInitialized) {
    boat.x = 400;
    boat.y = 300;
    boat.speed = 3; // Reset speed to default
    ensureBoatSpawnOnWater(); // Make sure boat spawns on water
  }
  boat.direction = 0;
  boat.targetDirection = 0;
  
  // Reset camera
  if (camera) {
    camera.x = 0;
    camera.y = 0;
  }
  
  // Reset score
  score = 0;
  
  // Reset shop
  SHOP_ITEMS.SPEED_BOOSTER.purchased = 0;
  shopExpanded = false;
  purchaseMessage = "";
  purchaseMessageTimer = 0;
  
  gameInitialized = true;
}

function updateGameplay() {
  if (gameState !== GAME_STATES.PLAYING) return;
  
  // Apply passive damage over time
  passiveDamageCounter++;
  if (passiveDamageCounter >= BOAT_STATS.PASSIVE_DAMAGE_INTERVAL) {
    takeDamage(1, 'passive');
    passiveDamageCounter = 0;
  }
  
  // Update purchase message timer
  if (purchaseMessageTimer > 0) {
    purchaseMessageTimer--;
  }
  
  // Update damage effects
  updateDamageEffects();
  
  // Check for death
  if (boatHealth <= 0) {
    gameState = GAME_STATES.DEATH;
    deathScreenAlpha = 0; // Start fade in
  }
}

function updateDamageEffects() {
  // Update tint effect
  if (damageEffect.tintDuration > 0) {
    damageEffect.tintDuration--;
  } else {
    damageEffect.tintAlpha = 0;
  }
  
  // Update shake effect
  if (damageEffect.shakeDuration > 0) {
    damageEffect.shakeDuration--;
  } else {
    damageEffect.shakeAmount = 0;
  }
  
  // Apply screen shake decay
  if (damageEffect.shakeAmount > 0) {
    damageEffect.shakeAmount *= DAMAGE_EFFECTS.SHAKE_FALLOFF;
    
    // Reset to zero if value becomes negligibly small
    if (damageEffect.shakeAmount < 0.1) {
      damageEffect.shakeAmount = 0;
    }
  }
}

function takeDamage(amount, source) {
  if (amount <= 0) return;
  
  let remainingDamage = amount;
  
  // First, apply damage to shield
  if (boatShield > 0) {
    const shieldDamage = Math.min(boatShield, remainingDamage);
    boatShield -= shieldDamage;
    remainingDamage -= shieldDamage;
    
    // If shield reaches 0, block any overflow damage this frame
    if (boatShield <= 0 && remainingDamage > 0) {
      remainingDamage = 0; // Shield blocks overflow damage
    }
  }
  
  // Apply remaining damage to health
  if (remainingDamage > 0) {
    boatHealth -= remainingDamage;
    boatHealth = Math.max(0, boatHealth); // Clamp to 0
  }
  
  // Apply visual damage effects based on source
  if (source === 'land') {
    // Strong red tint and large screen shake for land collision
    damageEffect.tintAlpha = DAMAGE_EFFECTS.LAND_TINT_ALPHA;
    damageEffect.tintDuration = DAMAGE_EFFECTS.TINT_DURATION;
    damageEffect.shakeAmount = DAMAGE_EFFECTS.LAND_SHAKE_AMOUNT;
    damageEffect.shakeDuration = DAMAGE_EFFECTS.SHAKE_DURATION;
  } else if (source === 'rock') {
    // Medium red tint and small screen shake for rock collision
    damageEffect.tintAlpha = DAMAGE_EFFECTS.ROCK_TINT_ALPHA;
    damageEffect.tintDuration = DAMAGE_EFFECTS.TINT_DURATION;
    damageEffect.shakeAmount = DAMAGE_EFFECTS.ROCK_SHAKE_AMOUNT;
    damageEffect.shakeDuration = DAMAGE_EFFECTS.SHAKE_DURATION;
  } else if (source === 'passive') {
    // Light red tint but no screen shake for passive damage
    damageEffect.tintAlpha = DAMAGE_EFFECTS.PASSIVE_TINT_ALPHA;
    damageEffect.tintDuration = DAMAGE_EFFECTS.TINT_DURATION;
    // No screen shake for passive damage
  }
}

function drawStartScreen() {
  // Semi-transparent background
  fill(0, 0, 0, 150);
  rect(0, 0, width, height);
  
  // Title
  fill(255, 255, 255);
  textAlign(CENTER, CENTER);
  textSize(48);
  text("Pirates of the Caribbean", width / 2, height / 2 - 145);
  
  // Game description
  textSize(16);
  const description = [
    "Navigate the treacherous seas as a pirate captain!",
    "",
    "• Use WASD or Arrow Keys to move",
    "• Avoid land and rocks to preserve your health",
    "• Collect coins to increase your score",
    "• Your health slowly decreases over time",
    "• Land contact deals 10 damage",
    "• Rock contact deals 2 damage",
    "• Shield blocks overflow damage when depleted"
  ];
  
  for (let i = 0; i < description.length; i++) {
    text(description[i], width / 2, height / 2 - 95 + i * 25);
  }
  
  // Press any key instruction
  textSize(24);
  text("Press any key or click to start", width / 2, height / 2 + 150);
}

function drawDeathScreen() {
  // Fade in death screen
  deathScreenAlpha = Math.min(255, deathScreenAlpha + 8);
  
  // Semi-transparent background
  fill(0, 0, 0, deathScreenAlpha * 0.8);
  rect(0, 0, width, height);
  
  // Death message
  fill(255, 0, 0, deathScreenAlpha);
  textAlign(CENTER, CENTER);
  textSize(48);
  text("GAME OVER", width / 2, height / 2 - 60);
  
  // Final score
  fill(255, 255, 255, deathScreenAlpha);
  textSize(24);
  text(`Final Score: ${totalScore}`, width / 2, height / 2);
  
  // Restart instruction
  textSize(20);
  text("Press any key or click to restart", width / 2, height / 2 + 60);
}

function drawHealthShieldBars() {
  if (gameState !== GAME_STATES.PLAYING) return;
  
  const barX = 20;
  const barY = 20;
  const barWidth = 200;
  const barHeight = 20;
  const barSpacing = 30;
  
  // Health bar background
  fill(50, 50, 50);
  rect(barX, barY, barWidth, barHeight);
  
  // Health bar fill
  const healthPercent = boatHealth / BOAT_STATS.MAX_HEALTH;
  fill(255, 0, 0); // Red health bar
  rect(barX, barY, barWidth * healthPercent, barHeight);
  
  // Health bar border
  noFill();
  stroke(255);
  strokeWeight(2);
  rect(barX, barY, barWidth, barHeight);
  
  // Health text
  fill(255);
  noStroke();
  textAlign(LEFT, TOP);
  textSize(14);
  text(`Health: ${Math.ceil(boatHealth)}/${BOAT_STATS.MAX_HEALTH}`, barX + barWidth + 10, barY + 3);
  
  // Shield bar background
  fill(50, 50, 50);
  rect(barX, barY + barSpacing, barWidth, barHeight);
  
  // Shield bar fill
  const shieldPercent = boatShield / BOAT_STATS.MAX_SHIELD;
  fill(0, 100, 255); // Blue shield bar
  rect(barX, barY + barSpacing, barWidth * shieldPercent, barHeight);
  
  // Shield bar border
  noFill();
  stroke(255);
  strokeWeight(2);
  rect(barX, barY + barSpacing, barWidth, barHeight);
  
  // Shield text
  fill(255);
  noStroke();
  text(`Shield: ${Math.ceil(boatShield)}/${BOAT_STATS.MAX_SHIELD}`, barX + barWidth + 10, barY + barSpacing + 3);
}

function drawBoatStats() {
  if (gameState !== GAME_STATES.PLAYING) return;
  
  const statsX = 20;
  const statsY = 90;
  
  fill(255);
  noStroke();
  textAlign(LEFT, TOP);
  textSize(14);
  
  // Calculate grid position
  const gridX = Math.floor(boat.x / tileSize);
  const gridY = Math.floor(boat.y / tileSize);
  
  text(`Position: (${gridX}, ${gridY})`, statsX, statsY);
  text(`Speed: ${boat.speed}`, statsX, statsY + 20);
  text('Frame Rate: ' + frameRate().toFixed(2), statsX, statsY + 40);
}

function drawShop() {
  if (gameState !== GAME_STATES.PLAYING) return;
  
  const shopX = shopExpanded ? width - shopWidth : width - shopCollapsedWidth;
  const shopY = 0;
  const shopHeight = height;
  
  // Shop background
  fill(40, 40, 60, 240);
  stroke(150, 150, 200);
  strokeWeight(2);
  rect(shopX, shopY, shopExpanded ? shopWidth : shopCollapsedWidth, shopHeight);
  
  if (shopExpanded) {
    // Shop title
    fill(255, 255, 150);
    textAlign(CENTER, TOP);
    textSize(22);
    text("⚓ SHIP SHOP ⚓", shopX + shopWidth / 2, 15);
    
    // Draw shop items
    let itemY = 60;
    const itemHeight = 75;
    const itemMargin = 10;
    
    Object.keys(SHOP_ITEMS).forEach((key, index) => {
      const item = SHOP_ITEMS[key];
      const currentItemY = itemY + index * (itemHeight + itemMargin);
      
      // Check if item can be purchased
      const canAfford = score >= item.cost;
      const canPurchase = !item.maxPurchases || item.purchased < item.maxPurchases;
      const available = canAfford && canPurchase;
      
      // Check if mouse is hovering over item
      const isHovered = mouseX >= shopX + 10 && mouseX <= shopX + shopWidth - 10 &&
                       mouseY >= currentItemY && mouseY <= currentItemY + itemHeight;
      
      // Item background with hover effect
      if (available && isHovered) {
        fill(80, 100, 80, 200);
        stroke(180, 200, 180);
      } else if (available) {
        fill(60, 80, 60, 180);
        stroke(150, 170, 150);
      } else {
        fill(40, 40, 40, 150);
        stroke(80, 80, 80);
      }
      strokeWeight(1);
      rect(shopX + 10, currentItemY, shopWidth - 20, itemHeight);
      
      // Item icon/emoji
      fill(available ? 255 : 120);
      textAlign(LEFT, TOP);
      textSize(16);
      const itemIcon = key === 'HEALTH_POTION' ? '❤️' : 
                      key === 'SHIELD_DEVICE' ? '🛡️' : '⚡';
      text(itemIcon, shopX + 15, currentItemY + 5);
      
      // Item text
      textSize(13);
      text(item.name, shopX + 35, currentItemY + 8);
      
      textSize(11);
      fill(available ? 200 : 100);
      text(item.description, shopX + 15, currentItemY + 28);
      
      // Cost and purchase info
      if (available) {
        fill(255, 215, 0);
      } else {
        fill(120, 100, 0);
      }
      text(`💰 ${item.cost} coins`, shopX + 15, currentItemY + 45);
      
      if (item.maxPurchases) {
        fill(available ? 150 : 80);
        text(`Owned: ${item.purchased}/${item.maxPurchases}`, shopX + 15, currentItemY + 58);
      }
      
      // Purchase button effect
      if (available && isHovered) {
        fill(255, 255, 255, 100);
        noStroke();
        rect(shopX + 10, currentItemY, shopWidth - 20, itemHeight);
      }
      
      // Store button area for click detection
      item._buttonArea = {
        x: shopX + 10,
        y: currentItemY,
        width: shopWidth - 20,
        height: itemHeight,
        available: available
      };
    });
    
    // Instructions and purchase message
    fill(180);
    textAlign(CENTER, BOTTOM);
    textSize(10);
    text("Click items to purchase", shopX + shopWidth / 2, height - 25);
    
    // Purchase feedback message
    if (purchaseMessageTimer > 0) {
      fill(100, 255, 100);
      textSize(12);
      text(purchaseMessage, shopX + shopWidth / 2, height - 10);
    }
  }
  
  // Toggle arrow with better styling
  const arrowX = shopExpanded ? shopX + 15 : shopX + shopCollapsedWidth / 2;
  const arrowY = height / 2;
  
  // Arrow background
  fill(60, 60, 80, 180);
  stroke(150);
  strokeWeight(1);
  ellipse(arrowX, arrowY, 25, 25);
  
  // Arrow symbol
  fill(255);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(14);
  if (shopExpanded) {
    text("►", arrowX, arrowY); // Right arrow (close)
  } else {
    text("◄", arrowX, arrowY); // Left arrow (open)
  }
  
  // Store arrow click area
  shopArrowArea = {
    x: arrowX - 15,
    y: arrowY - 15,
    width: 30,
    height: 30
  };
}

function drawDamageEffects() {
  if (gameState !== GAME_STATES.PLAYING) return;
  
  // Draw red tint effect when taking damage
  if (damageEffect.tintAlpha > 0) {
    // Draw red tint around the edges of the screen
    noStroke();
    
    // Use a gradient from edge to center for a more natural vignette effect
    const gradientSteps = 10;
    for (let i = 0; i < gradientSteps; i++) {
      const ratio = i / gradientSteps;
      const alpha = damageEffect.tintAlpha * (1 - ratio); // Decrease alpha as we move toward center
      
      if (alpha <= 0) continue;
      
      fill(255, 0, 0, alpha);
      
      // Draw a frame of rectangles that gets smaller toward the center
      const frameSize = ratio * 40; // Size of frame based on gradient position
      rect(0, 0, width, frameSize); // Top rectangle
      rect(0, height - frameSize, width, frameSize); // Bottom rectangle
      rect(0, frameSize, frameSize, height - frameSize * 2); // Left rectangle
      rect(width - frameSize, frameSize, frameSize, height - frameSize * 2); // Right rectangle
    }
  }
}

function handleKeyPress() {
  if (gameState === GAME_STATES.START) {
    if (gameInitialized) {
      gameState = GAME_STATES.PLAYING;
    }
  } else if (gameState === GAME_STATES.DEATH) {
    // Restart game
    initializeGameplay();
    gameState = GAME_STATES.PLAYING;
  }
}

function handleShopClick(mouseX, mouseY) {
  if (gameState !== GAME_STATES.PLAYING) return false;
  
  // Check arrow click
  if (shopArrowArea && 
      mouseX >= shopArrowArea.x && mouseX <= shopArrowArea.x + shopArrowArea.width &&
      mouseY >= shopArrowArea.y && mouseY <= shopArrowArea.y + shopArrowArea.height) {
    shopExpanded = !shopExpanded;
    return true;
  }
  
  // Check item clicks if shop is expanded
  if (shopExpanded) {
    Object.keys(SHOP_ITEMS).forEach(key => {
      const item = SHOP_ITEMS[key];
      if (item._buttonArea && item._buttonArea.available &&
          mouseX >= item._buttonArea.x && mouseX <= item._buttonArea.x + item._buttonArea.width &&
          mouseY >= item._buttonArea.y && mouseY <= item._buttonArea.y + item._buttonArea.height) {
        // Purchase item
        if (score >= item.cost) {
          score -= item.cost;
          item.effect();
          purchaseMessage = `${item.name} purchased!`;
          purchaseMessageTimer = 120; // Show message for 2 seconds at 60fps
          console.log(`Purchased ${item.name} for ${item.cost} coins`);
        }
      }
    });
  }
  
  return false;
}
