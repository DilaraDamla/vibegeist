// one hat per chick (or none), sized off bodyR so it stays legible even at
// widget scale - the earlier props (lantern, map, compass...) were a few px
// across and disappeared entirely in the small window.
//
// drawn in the chick's local "facing right, feet at origin" space, after the
// face - bodyCy is the body center's local y (negative), the head top sits
// at bodyCy - bodyR. Returns how far the hat reaches above the head top, so
// the leader crown can float above it instead of clipping into it.
export function drawHat(ctx, name, bodyR, bodyCy, color, t) {
  const R = bodyR;
  const top = bodyCy - R;

  if (name === 'beanie') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, bodyCy - R * 0.66, R * 0.74, R * 0.5, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    // folded brim - sits above the eye line, not over it
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(-R * 0.76, bodyCy - R * 0.76, R * 1.52, R * 0.12);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, top - R * 0.16, R * 0.18, 0, Math.PI * 2);
    ctx.fill();
    return R * 0.34;
  }

  if (name === 'bandana') {
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = R * 0.24;
    ctx.beginPath();
    ctx.moveTo(-R * 0.78, bodyCy - R * 0.6);
    ctx.lineTo(R * 0.72, bodyCy - R * 0.74);
    ctx.stroke();
    // two knot tails flapping out behind the head
    const flap = Math.sin(t * 6) * R * 0.12;
    ctx.lineWidth = R * 0.14;
    ctx.beginPath();
    ctx.moveTo(-R * 0.78, bodyCy - R * 0.6);
    ctx.lineTo(-R * 1.3, bodyCy - R * 0.72 + flap);
    ctx.moveTo(-R * 0.78, bodyCy - R * 0.6);
    ctx.lineTo(-R * 1.22, bodyCy - R * 0.4 - flap);
    ctx.stroke();
    return 0;
  }

  if (name === 'tophat') {
    ctx.fillStyle = '#26202e';
    ctx.fillRect(-R * 0.55, top + R * 0.02, R * 1.1, R * 0.14);
    ctx.fillRect(-R * 0.34, top - R * 0.6, R * 0.68, R * 0.64);
    ctx.fillStyle = color;
    ctx.fillRect(-R * 0.34, top - R * 0.12, R * 0.68, R * 0.14);
    return R * 0.62;
  }

  if (name === 'flower') {
    const fx = R * 0.2;
    const fy = top + R * 0.08;
    const sway = Math.sin(t * 2) * 0.2;
    ctx.fillStyle = color;
    for (let i = 0; i < 5; i++) {
      const a = sway + (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(fx + Math.cos(a) * R * 0.17, fy + Math.sin(a) * R * 0.17, R * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffe066';
    ctx.beginPath();
    ctx.arc(fx, fy, R * 0.1, 0, Math.PI * 2);
    ctx.fill();
    return R * 0.2;
  }

  return 0;
}
