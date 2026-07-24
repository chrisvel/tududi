{
  description = "Tududi - self-hosted task management system";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
        nodejs = pkgs.nodejs_22;
        pname = "tududi";
        src = builtins.path {
          path = ./.;
          name = "tududi-src";
        };

        tududiPackage = import ./nix/tududi.nix {
          inherit pkgs nodejs src;
        };
      in
      {
        packages.${pname} = tududiPackage;
        packages.default = tududiPackage;

        devShells.default = pkgs.mkShell {
          buildInputs = [
            nodejs
            pkgs.python3
            pkgs.gnumake
            pkgs.gcc
            pkgs.sqlite
          ];
          shellHook = ''
            echo "Tududi development shell"
          '';
        };
      }
    ) // {
      nixosModules.tududi = { config, lib, pkgs, ... }:
        import ./nix/module.nix {
          package = self.packages.${pkgs.system}.default;
          inherit config lib pkgs;
        };
      nixosModules.default = self.nixosModules.tududi;
    };
}
