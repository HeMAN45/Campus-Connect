import express from 'express';

// Express 4 does not forward rejected promises, so every handler is wrapped once here.
export function makeRouter() {
  const router = express.Router();
  for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    const original = router[method].bind(router);
    router[method] = (path, ...handlers) =>
      original(
        path,
        ...handlers.map((h) => (req, res, next) => {
          try {
            const out = h(req, res, next);
            if (out && typeof out.then === 'function') out.catch(next);
          } catch (e) {
            next(e);
          }
        }),
      );
  }
  return router;
}
