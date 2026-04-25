import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function githubPagesBase() {
  if (process.env.VITE_BASE_PATH) {
    return process.env.VITE_BASE_PATH;
  }

  if (process.env.GITHUB_REPOSITORY) {
    const [, repoName] = process.env.GITHUB_REPOSITORY.split("/");
    return `/${repoName}/`;
  }

  return "/";
}

export default defineConfig({
  base: githubPagesBase(),
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.js"
  }
});
