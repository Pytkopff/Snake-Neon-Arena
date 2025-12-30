# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Adding Chill Music for the Chill mode

This project can play a remote chill music file (configured in `src/utils/constants.js`) or fall back to a lightweight synth.

If you prefer to use a remote file, set `SOUNDS.CHILL_MUSIC` to the desired URL. By default it is set to a Pixabay loop (you provided):

`https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3`

If you intentionally add a local file at `public/chill-loop.mp3`, make sure it doesn't conflict with a remote URL you configured.
