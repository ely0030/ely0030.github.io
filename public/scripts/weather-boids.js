// Local-only flocking. Toroidal boundaries; no target, centre, orbit, or global choreography.
export function stepFlock(birds, width, height, dt) {
  const wrapDelta = (d, size) => d - Math.round(d / size) * size;
  const steer = (x, y, vx, vy) => {
    const length = Math.hypot(x, y);
    return length > 1e-6 ? [x / length * 32 - vx, y / length * 32 - vy] : [0, 0];
  };
  const forces = birds.map((b, i) => {
    let sx = 0, sy = 0, ax = 0, ay = 0, cx = 0, cy = 0, near = 0;
    for (let j = 0; j < birds.length; j++) {
      if (i === j) continue;
      const other = birds[j];
      const dx = wrapDelta(other.x - b.x, width);
      const dy = wrapDelta(other.y - b.y, height);
      const d2 = dx * dx + dy * dy;
      if (d2 >= 90 * 90) continue;
      near++;
      ax += other.vx; ay += other.vy;
      cx += dx; cy += dy;
      if (d2 < 24 * 24) {
        if (d2 < .001) { sx += i < j ? -1 : 1; sy += i < j ? 1 : -1; }
        else { sx -= dx / d2; sy -= dy / d2; }
      }
    }
    const separation = steer(sx, sy, b.vx, b.vy);
    const alignment = near ? steer(ax / near, ay / near, b.vx, b.vy) : [0, 0];
    const cohesion = near ? steer(cx / near, cy / near, b.vx, b.vy) : [0, 0];
    let fx = separation[0] * 1.8 + alignment[0] * .85 + cohesion[0] * .48;
    let fy = separation[1] * 1.8 + alignment[1] * .85 + cohesion[1] * .48;
    const force = Math.hypot(fx, fy);
    if (force > 34) { fx *= 34 / force; fy *= 34 / force; }
    return [fx, fy];
  });
  birds.forEach((b, i) => {
    b.vx += forces[i][0] * dt; b.vy += forces[i][1] * dt;
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > 0) {
      const adjusted = Math.max(16, Math.min(40, speed));
      b.vx *= adjusted / speed; b.vy *= adjusted / speed;
    } else b.vx = 16;
    b.x = ((b.x + b.vx * dt) % width + width) % width;
    b.y = ((b.y + b.vy * dt) % height + height) % height;
  });
}

export function drawDitheredFly(ctx, p, time) {
  const flicker = .55 + .4 * Math.sin(time * 1.4 + p.phase);
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const x = Math.round(p.x / 4) * 4, y = Math.round(p.y / 6) * 6;
  ctx.save();
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // Ordered character-density dithering, not blur or a radial gradient.
  for (let row = -2; row <= 2; row++) {
    for (let col = -2; col <= 2; col++) {
      const distance = Math.sqrt(col * col + row * row * 1.3);
      const ink = Math.max(0, 1 - distance / 2.8) * (.58 + flicker * .42);
      const threshold = bayer[((row + 2) % 4) * 4 + ((col + 2) % 4)] / 16;
      if (ink < threshold) continue;
      ctx.fillStyle = p.kind === 'swarm' ? `rgba(79,76,57,${.42 + ink * .48})` : `rgba(130,112,44,${.45 + ink * .45})`;
      ctx.fillText(ink > .7 ? ':' : ink > .42 ? ',' : '.', x + col * 4, y + row * 6);
    }
  }
  ctx.restore();
}
