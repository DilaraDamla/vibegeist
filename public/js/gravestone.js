// a small permanent marker left where a task was abandoned mid-climb (its
// session went stale and left without ever finishing) - not for a normal
// completion, which still gets the summit + rising-spirit treatment. Colored
// by the departed task's own hue, so it reads as "theirs".
const INK = 'rgba(20,14,28,0.55)';

export function drawGravestone(ctx, x, y, hue) {
  // small mound of dirt
  ctx.fillStyle = 'rgba(40,34,54,0.5)';
  ctx.beginPath();
  ctx.ellipse(x, y + 2, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // the stone itself, rounded top
  const stoneGrad = ctx.createLinearGradient(x - 5, y, x + 5, y);
  stoneGrad.addColorStop(0, '#4a4558');
  stoneGrad.addColorStop(0.5, '#69647e');
  stoneGrad.addColorStop(1, '#3a3648');
  ctx.fillStyle = stoneGrad;
  ctx.beginPath();
  ctx.moveTo(x - 5, y + 1);
  ctx.lineTo(x - 5, y - 8);
  ctx.quadraticCurveTo(x - 5, y - 13, x, y - 13);
  ctx.quadraticCurveTo(x + 5, y - 13, x + 5, y - 8);
  ctx.lineTo(x + 5, y + 1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // a single small flower leaning against it, in the departed task's hue
  const stemX = x + 7;
  const stemTopY = y - 7;
  ctx.strokeStyle = '#5a7a4a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(stemX, y + 1);
  ctx.quadraticCurveTo(stemX + 1, y - 4, stemX, stemTopY);
  ctx.stroke();

  ctx.fillStyle = `hsl(${hue}, 70%, 68%)`;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(stemX + Math.cos(a) * 2, stemTopY + Math.sin(a) * 2, 1.6, 1, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffe27a';
  ctx.beginPath();
  ctx.arc(stemX, stemTopY, 1, 0, Math.PI * 2);
  ctx.fill();
}
