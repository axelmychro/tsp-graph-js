{
  inputs.nixpkgs.url = "github:nixos/nixpkgs";

  outputs =
    { self, nixpkgs }:
    let
      pkgs = nixpkgs.legacyPackages.x86_64-linux;
      packages = with pkgs; [
        nodejs
        nodejs.npm
        pnpm
      ];
    in
    {
      devShells.x86_64-linux.default = pkgs.mkShell {
        buildInputs = with pkgs; [
          packages

          bashInteractive
        ];
        shellHook = ''
          echo 'Entering Node.js development environment'
        '';
      };
    };
}
