/**
 *  Bouncing Odyssey: A Colorful Journey
 */ 

// Global simulation parameters
let containerR;         // Radius of the container sphere
const ballRadius = 7;   // Radius of each ball
let balls = [];         // Array holding all Ball objects

// Control variables for sliders
let speedSlider;        // Controls ball speed multiplier
let ballSlider;         // Controls the number of balls
let rotationSlider;     // Controls the rotation speed of the container

// Labels for the sliders
let speedLabel, ballLabel, rotationLabel;

// Simulation rotation (for non-following view)
let angle = 0;

// Following mode variables
let following = false;      // When true, camera follows a selected ball
let selectedBall = null;
// For smooth transitions when following a ball, we keep global camera position and target.
let followCamPos = null;
let followCamTarget = null;
let followBallVel = null;   // Smoothed ball velocity for computing offset

// Interpolation factors (lower values make transitions slower and smoother)
const camLerpAmt = 0.02;    // For camera position and target
const velLerpAmt = 0.02;    // For smoothing the ball's velocity

// Multiplier for picking radius to make clicking easier
const pickingMultiplier = 3;

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  containerR = min(windowWidth, windowHeight) * 0.4;
  
  // Create labeled slider for Ball Speed.
  speedLabel = createP("Ball Speed");
  speedLabel.position(10, 0);
  speedSlider = createSlider(0.1, 5, 1, 0.1);
  speedSlider.position(10, 40);
  
  // Create labeled slider for Number of Balls.
  ballLabel = createP("Number of Balls");
  ballLabel.position(10, 70);
  ballSlider = createSlider(10, 500, 100, 1);
  ballSlider.position(10, 110);
  ballSlider.input(adjustBalls); // Dynamically adjust ball count
  
  // Create labeled slider for Rotation Speed.
  rotationLabel = createP("Rotation Speed");
  rotationLabel.position(10, 140);
  rotationSlider = createSlider(0, 0.05, 0.005, 0.001);
  rotationSlider.position(10, 180);
  
  // Initially create balls based on the default ballSlider value.
  let initialCount = ballSlider.value();
  for (let i = 0; i < initialCount; i++) {
    balls.push(new Ball());
  }
  
  strokeWeight(2);
}

function draw() {
  background(0, 20);
  
  // Update the ball speed multiplier from the slider.
  let speedFactor = speedSlider.value();
  
  if (following && selectedBall !== null) {
    // ---- FOLLOWING MODE WITH EXTRA SMOOTHING ----
    // Smooth the ball's velocity to avoid abrupt changes.
    if (followBallVel === null) {
      followBallVel = selectedBall.vel.copy();
    } else {
      followBallVel = p5.Vector.lerp(followBallVel, selectedBall.vel, velLerpAmt);
    }
    
    // Compute the desired camera offset using the smoothed velocity.
    let desiredOffset;
    if (followBallVel.mag() > 0.001) {
      desiredOffset = followBallVel.copy().normalize().mult(-100);
    } else {
      desiredOffset = createVector(0, 0, -100);
    }
    
    // Compute the desired camera position and target.
    let desiredCamPos = p5.Vector.add(selectedBall.pos, desiredOffset);
    let desiredCamTarget = selectedBall.pos.copy();
    
    // Initialize followCamPos/Target if null.
    if (followCamPos === null) {
      followCamPos = desiredCamPos.copy();
      followCamTarget = desiredCamTarget.copy();
    }
    
    // Smoothly interpolate the camera position and target toward the desired values.
    followCamPos = p5.Vector.lerp(followCamPos, desiredCamPos, camLerpAmt);
    followCamTarget = p5.Vector.lerp(followCamTarget, desiredCamTarget, camLerpAmt);
    
    // Set the camera using the smoothed positions.
    camera(followCamPos.x, followCamPos.y, followCamPos.z,
           followCamTarget.x, followCamTarget.y, followCamTarget.z,
           0, 1, 0);
    
    // Draw the container sphere and update/draw all balls (no extra global rotation).
    push();
      noFill();
      stroke(255, 50);
      sphere(containerR);
    pop();
    
    for (let ball of balls) {
      ball.update(speedFactor);
      ball.show();
    }
    
  } else {
    // ---- NORMAL ROTATING VIEW ----
    // Reset followCam and velocity variables when not following.
    followCamPos = null;
    followCamTarget = null;
    followBallVel = null;
    
    // Use default camera (centered view)
    let camZ = (height / 2) / tan(PI / 6);
    camera(0, 0, camZ, 0, 0, 0, 0, 1, 0);
    
    // Rotate the entire scene around the Y-axis.
    let rotSpeed = rotationSlider.value();
    rotateY(angle);
    angle += rotSpeed;
    
    // Draw the container sphere.
    push();
      noFill();
      stroke(255, 50);
      sphere(containerR);
    pop();
    
    // Update and draw each ball.
    for (let ball of balls) {
      ball.update(speedFactor);
      ball.show();
    }
  }
}

// Adjust the number of balls based on the ballSlider value without fully resetting the simulation.
function adjustBalls() {
  let desiredCount = ballSlider.value();
  let currentCount = balls.length;
  
  if (desiredCount > currentCount) {
    // Add new balls.
    let diff = desiredCount - currentCount;
    for (let i = 0; i < diff; i++) {
      balls.push(new Ball());
    }
  } else if (desiredCount < currentCount) {
    // Remove extra balls.
    balls.splice(desiredCount, currentCount - desiredCount);
  }
}

// Mouse Click Handler:
// Clicking toggles between following a ball and returning to the default view.
// When not following, a ray is cast to detect if a ball was clicked.
function mouseClicked() {
  // Prevent clicks on the sliders from triggering view changes.
  if (mouseY < 220) return;
  
  if (following) {
    // If already following a ball, clicking anywhere returns to the default view.
    following = false;
    selectedBall = null;
    return;
  }
  
  // --- Ray Picking Setup ---
  // Compute a ray from the default camera position (used in non-following mode).
  let fov = PI / 3; // Default field-of-view.
  let aspect = width / height;
  let tanFov = tan(fov / 2);
  
  // Convert mouse coordinates to normalized device coordinates.
  let x_ndc = (mouseX - width / 2) / (width / 2);
  let y_ndc = (mouseY - height / 2) / (height / 2);
  
  // In camera (view) space, the default camera looks along the -Z axis.
  let rayDir = createVector(x_ndc * aspect * tanFov, -y_ndc * tanFov, -1);
  rayDir.normalize();
  
  // Default camera position used in non-following view.
  let camZ = (height / 2) / tan(PI / 6);
  let rayOrigin = createVector(0, 0, camZ);
  
  // Because the non-following view rotates the scene by 'angle', we must rotate
  // each ball's position to get its world coordinate.
  let selected = null;
  let bestT = Infinity;
  
  for (let ball of balls) {
    let worldPos = rotateVectorY(ball.pos, angle);
    // Use an increased picking radius for easier selection.
    let t = raySphereIntersection(rayOrigin, rayDir, worldPos, ballRadius * pickingMultiplier);
    if (t !== null && t > 0 && t < bestT) {
      bestT = t;
      selected = ball;
    }
  }
  
  if (selected !== null) {
    following = true;
    selectedBall = selected;
  }
}

// Utility: Rotate a vector about the Y-axis.
function rotateVectorY(v, theta) {
  let x = v.x * cos(theta) - v.z * sin(theta);
  let z = v.x * sin(theta) + v.z * cos(theta);
  return createVector(x, v.y, z);
}

// Utility: Ray-Sphere Intersection.
// Returns the t value along the ray where an intersection occurs (or null if none).
function raySphereIntersection(rayOrigin, rayDir, sphereCenter, sphereRadius) {
  let oc = p5.Vector.sub(rayOrigin, sphereCenter);
  let a = rayDir.dot(rayDir);
  let b = 2 * oc.dot(rayDir);
  let c = oc.dot(oc) - sphereRadius * sphereRadius;
  let discriminant = b * b - 4 * a * c;
  if (discriminant < 0) {
    return null;
  } else {
    let t = (-b - sqrt(discriminant)) / (2 * a);
    if (t < 0) t = (-b + sqrt(discriminant)) / (2 * a);
    return t;
  }
}

// Ball Class
class Ball {
  constructor() {
    // Initialize the ball's position randomly inside the container sphere,
    // ensuring the ball starts within (containerR - ballRadius).
    let pos = p5.Vector.random3D();
    pos.mult(random(0, containerR - ballRadius));
    this.pos = pos;
    
    // Give the ball a random velocity (speed between 1 and 3).
    let vel = p5.Vector.random3D();
    vel.mult(random(1, 3));
    this.vel = vel;
    
    // Maintain a trail (history of recent positions).
    this.trail = [];
    
    // Choose a random bright color.
    this.color = [random(100, 255), random(100, 255), random(100, 255)];
  }
  
  // Update the ball's position and trail.
  update(speedFactor) {
    this.trail.push(this.pos.copy());
    if (this.trail.length > 20) {
      this.trail.shift();
    }
    
    // Update position with current velocity.
    this.pos.add(p5.Vector.mult(this.vel, speedFactor));
    
    // Collision detection with the container sphere.
    let d = this.pos.mag();
    if (d + ballRadius > containerR) {
      // Reflect the velocity off the sphere wall.
      let n = this.pos.copy().normalize();
      let dot = this.vel.dot(n);
      this.vel.sub(p5.Vector.mult(n, 2 * dot));
      // Reposition the ball exactly on the inner surface.
      this.pos = n.mult(containerR - ballRadius);
    }
  }
  
  // Draw the ball and its fading trail.
  show() {
    // Draw the trail.
    noFill();
    beginShape();
    for (let i = 0; i < this.trail.length; i++) {
      let pos = this.trail[i];
      let alpha = map(i, 0, this.trail.length, 50, 255);
      stroke(this.color[0], this.color[1], this.color[2], alpha);
      vertex(pos.x, pos.y, pos.z);
    }
    endShape();
    
    // Draw the ball.
    noStroke();
    fill(this.color[0], this.color[1], this.color[2]);
    push();
      translate(this.pos.x, this.pos.y, this.pos.z);
      sphere(ballRadius);
    pop();
  }
}

// Adjust Canvas on Window Resize.
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  containerR = min(windowWidth, windowHeight) * 0.4;
}