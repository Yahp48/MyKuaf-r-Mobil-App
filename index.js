import React from "react";
import { registerRootComponent } from "expo";
import { CrashRoot, installCrashGuard, reportError } from "./components/CrashGuard";

// Çökme koruması uygulamadan önce kurulur: açılışta oluşan hata da yakalanır ve ekranda gösterilir.
installCrashGuard();

let App = null;
let bootError = null;
try {
  App = require("./App").default;
} catch (e) {
  bootError = e;
  reportError(e, { fatal: true, where: "boot" });
}

registerRootComponent(() => React.createElement(CrashRoot, { App, bootError }));
