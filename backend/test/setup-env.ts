import { testEnv } from "./test-env.ts";

Object.assign(process.env, testEnv());
