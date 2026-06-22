{ pkgs, nodejs ? pkgs.nodejs_22, src }:

pkgs.buildNpmPackage {
  pname = "tududi";
  version = (builtins.fromJSON (builtins.readFile ../package.json)).version;
  inherit src;

  npmDeps = pkgs.fetchNpmDeps {
    inherit src;
    hash = "sha256-q5kTn0j6C21hNwnyJTdf4Yf6WzsBpWrdbXdiBITl6Po=";
  };

  nativeBuildInputs = [
    pkgs.python3
    pkgs.gnumake
    pkgs.gcc
    pkgs.sqlite
    pkgs.pkg-config
  ];

  npmBuild = "frontend:build";

  installPhase = ''
    npm prune --omit=dev --no-audit --no-fund

    mkdir -p $out/libexec/tududi $out/bin
    cp -r node_modules $out/libexec/tududi/node_modules
    cp -r backend $out/libexec/tududi/backend
    cp -r dist $out/libexec/tududi/backend/dist
    cp package.json package-lock.json $out/libexec/tududi/
    ln -s $out/libexec/tududi/node_modules $out/libexec/tududi/backend/node_modules

    cat > $out/bin/tududi << 'EOF'
    #!@runtimeShell@ -e
    export NODE_ENV="''${NODE_ENV:-production}"
    exec @nodejs@/bin/node @out@/libexec/tududi/backend/app.js
    EOF
    substituteInPlace $out/bin/tududi \
      --replace '@runtimeShell@' '${pkgs.runtimeShell}' \
      --replace '@nodejs@' '${nodejs}' \
      --replace '@out@' "$out"
    chmod +x $out/bin/tududi
  '';

  meta = with pkgs.lib; {
    description = "Self-hosted task management with hierarchical organization";
    homepage = "https://github.com/chrisvel/tududi";
    license = licenses.isc;
    maintainers = [];
    platforms = platforms.linux;
  };
}
