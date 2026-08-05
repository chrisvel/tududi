{ package, config, lib, pkgs, ... }:

with lib;

let
  cfg = config.services.tududi;
  tududiPackage = package;
  nodejs = cfg.nodePackage;

  appDir = "${tududiPackage}/libexec/tududi/backend";
  nodeBin = "${nodejs}/bin/node";
  sequelizeCli = "${tududiPackage}/libexec/tududi/node_modules/.bin/sequelize-cli";

  tududiCmd = pkgs.writeShellScript "tududi-start" ''
    set -eu

    export NODE_ENV="${cfg.nodeEnv}"
    export PORT="${toString cfg.port}"
    export HOST="${cfg.host}"
    export DB_FILE="${cfg.dbFile}"
    export TUDUDI_ALLOWED_ORIGINS="${concatStringsSep "," cfg.allowedOrigins}"
    export TUDUDI_UPLOAD_PATH="${cfg.uploadPath}"
    export TUDUDI_TRUST_PROXY="${if cfg.trustProxy then "true" else "false"}"
    export TUDUDI_USER_EMAIL="${cfg.adminEmail}"

    ${lib.optionalString (cfg.adminPasswordFile != null) ''
    export TUDUDI_USER_PASSWORD="$(cat '${cfg.adminPasswordFile}')"
    ''}

    ${lib.optionalString (cfg.sessionSecretFile != null) ''
    export TUDUDI_SESSION_SECRET="$(cat '${cfg.sessionSecretFile}')"
    ''}
    export FRONTEND_URL="${cfg.frontendUrl}"
    export BACKEND_URL="${cfg.backendUrl}"
    export SWAGGER_ENABLED="${if cfg.swagger then "true" else "false"}"
    export DISABLE_SCHEDULER="${if cfg.disableScheduler then "true" else "false"}"
    export DISABLE_TELEGRAM="${if cfg.disableTelegram then "true" else "false"}"
    export FF_ENABLE_BACKUPS="${if cfg.featureFlags.backups then "true" else "false"}"
    export FF_ENABLE_CALDAV="${if cfg.featureFlags.caldav then "true" else "false"}"
    export FF_ENABLE_CALENDAR="${if cfg.featureFlags.calendar then "true" else "false"}"
    export FF_ENABLE_HABITS="${if cfg.featureFlags.habits then "true" else "false"}"
    export FF_ENABLE_MCP="${if cfg.featureFlags.mcp then "true" else "false"}"

    export ENABLE_EMAIL="${if cfg.email.enabled then "true" else "false"}"
    export EMAIL_SMTP_HOST="${cfg.email.smtpHost}"
    export EMAIL_SMTP_PORT="${toString cfg.email.smtpPort}"
    export EMAIL_SMTP_SECURE="${if cfg.email.smtpSecure then "true" else "false"}"
    export EMAIL_SMTP_USERNAME="${cfg.email.smtpUsername}"
    export EMAIL_SMTP_PASSWORD="${cfg.email.smtpPassword}"
    export EMAIL_FROM_ADDRESS="${cfg.email.fromAddress}"
    export EMAIL_FROM_NAME="${cfg.email.fromName}"

    export OIDC_ENABLED="${if cfg.oidc.enabled then "true" else "false"}"
    export PASSWORD_AUTH_ENABLED="${if cfg.passwordAuth then "true" else "false"}"
    export COOKIE_SECURE="${cfg.cookieSecure}"
    export DISABLE_HSTS="${if cfg.disableHsts then "true" else "false"}"

    export RATE_LIMITING_ENABLED="${if cfg.rateLimiting.enabled then "true" else "false"}"

    export NODE_PATH="${tududiPackage}/libexec/tududi/node_modules"

    cd "${appDir}"

    if [ ! -f "$DB_FILE" ]; then
      echo "Creating new database..."
      ${nodeBin} scripts/db-init.js
    fi

    echo "Running database migrations..."
    ${nodeBin} ${sequelizeCli} db:migrate --config config/database.js || echo "Migration check done"
    ${nodeBin} scripts/db-status.js

    if [ -n "''${TUDUDI_USER_EMAIL:-}" ] && [ -n "''${TUDUDI_USER_PASSWORD:-}" ]; then
      ${nodeBin} scripts/user-create.js "$TUDUDI_USER_EMAIL" "$TUDUDI_USER_PASSWORD" true || true
    fi

    exec ${nodeBin} app.js
  '';
in
{
  options.services.tududi = {
    enable = mkEnableOption "Tududi task management system";

    package = mkOption {
      type = types.package;
      default = tududiPackage;
      defaultText = "lib.meta.minimalModulePackage";
      description = "The Tududi package to use.";
    };

    nodePackage = mkOption {
      type = types.package;
      default = pkgs.nodejs_22;
      description = "Node.js package to use for running Tududi.";
    };

    nodeEnv = mkOption {
      type = types.enum [ "production" "development" "test" ];
      default = "production";
      description = "NODE_ENV for the Tududi service.";
    };

    port = mkOption {
      type = types.port;
      default = 3002;
      description = "Port the Tududi HTTP server binds to.";
    };

    host = mkOption {
      type = types.str;
      default = "0.0.0.0";
      description = "Host address the Tududi server binds to.";
    };

    stateDir = mkOption {
      type = types.path;
      default = "/var/lib/tududi";
      description = "State directory for database and uploads.";
    };

    dbFile = mkOption {
      type = types.str;
      default = "/var/lib/tududi/db/production.sqlite3";
      description = "Path to the SQLite database file.";
    };

    uploadPath = mkOption {
      type = types.path;
      default = "/var/lib/tududi/uploads";
      description = "Directory for uploaded files.";
    };

    sessionSecretFile = mkOption {
      type = types.nullOr types.path;
      default = null;
      description = "Path to a file containing the session secret key. Generate with: openssl rand -hex 64";
    };

    adminPasswordFile = mkOption {
      type = types.nullOr types.path;
      default = null;
      description = "Path to a file containing the admin user password for initial setup.";
    };

    allowedOrigins = mkOption {
      type = types.listOf types.str;
      default = [ "http://localhost:3002" ];
      description = "Allowed CORS origins.";
    };

    trustProxy = mkOption {
      type = types.bool;
      default = true;
      description = "Trust reverse proxy headers (set true behind nginx).";
    };

    adminEmail = mkOption {
      type = types.str;
      default = "";
      description = "Admin user email for initial setup.";
    };

    frontendUrl = mkOption {
      type = types.str;
      default = "http://localhost:3002";
      description = "Frontend URL for CORS and links.";
    };

    backendUrl = mkOption {
      type = types.str;
      default = "http://localhost:3002";
      description = "Backend URL for internal references.";
    };

    swagger = mkOption {
      type = types.bool;
      default = false;
      description = "Enable Swagger API documentation.";
    };

    disableScheduler = mkOption {
      type = types.bool;
      default = false;
      description = "Disable the task scheduler.";
    };

    disableTelegram = mkOption {
      type = types.bool;
      default = true;
      description = "Disable Telegram integration polling.";
    };

    passwordAuth = mkOption {
      type = types.bool;
      default = true;
      description = "Enable password-based authentication.";
    };

    cookieSecure = mkOption {
      type = types.str;
      default = "auto";
      description = "Session cookie secure flag: auto, true, or false.";
    };

    disableHsts = mkOption {
      type = types.bool;
      default = false;
      description = "Disable HSTS headers (use for HTTP dev setups).";
    };

    featureFlags = {
      backups = mkEnableOption "database backup feature";
      caldav = mkEnableOption "CalDAV synchronization";
      calendar = mkEnableOption "calendar view";
      habits = mkEnableOption "habit tracking";
      mcp = mkEnableOption "MCP server";
    };

    email = {
      enabled = mkEnableOption "email notifications";
      smtpHost = mkOption {
        type = types.str;
        default = "";
        description = "SMTP server hostname.";
      };
      smtpPort = mkOption {
        type = types.port;
        default = 587;
        description = "SMTP server port.";
      };
      smtpSecure = mkOption {
        type = types.bool;
        default = false;
        description = "Use TLS for SMTP.";
      };
      smtpUsername = mkOption {
        type = types.str;
        default = "";
        description = "SMTP authentication username.";
      };
      smtpPassword = mkOption {
        type = types.str;
        default = "";
        description = "SMTP authentication password.";
      };
      fromAddress = mkOption {
        type = types.str;
        default = "";
        description = "From address for outgoing emails.";
      };
      fromName = mkOption {
        type = types.str;
        default = "Tududi";
        description = "From name for outgoing emails.";
      };
    };

    oidc = {
      enabled = mkEnableOption "OIDC/SSO authentication";
      providers = mkOption {
        type = types.listOf (types.submodule {
          options = {
            name = mkOption {
              type = types.str;
              description = "Display name for the OIDC provider.";
            };
            slug = mkOption {
              type = types.str;
              description = "Unique slug/identifier for the provider.";
            };
            issuerUrl = mkOption {
              type = types.str;
              description = "OIDC issuer URL.";
            };
            clientId = mkOption {
              type = types.str;
              description = "OIDC client ID.";
            };
            clientSecret = mkOption {
              type = types.str;
              description = "OIDC client secret.";
            };
            scope = mkOption {
              type = types.str;
              default = "openid profile email";
              description = "OIDC scopes to request.";
            };
            autoProvision = mkOption {
              type = types.bool;
              default = true;
              description = "Auto-provision accounts on first login.";
            };
            adminEmailDomains = mkOption {
              type = types.listOf types.str;
              default = [];
              description = "Email domains that grant admin role.";
            };
          };
        });
        default = [];
        description = "OIDC identity providers.";
      };
    };

    rateLimiting = {
      enabled = mkOption {
        type = types.bool;
        default = true;
        description = "Enable rate limiting.";
      };
    };

    nginx = {
      enable = mkEnableOption "nginx reverse proxy for Tududi";
      serverName = mkOption {
        type = types.str;
        default = "tududi.local";
        description = "Server name for the nginx virtual host.";
      };
      serverAliases = mkOption {
        type = types.listOf types.str;
        default = [];
        description = "Additional server aliases.";
      };
      listenAddress = mkOption {
        type = types.str;
        default = "80";
        description = "Address and port nginx listens on.";
      };
      enableACME = mkOption {
        type = types.bool;
        default = false;
        description = "Enable ACME (Let's Encrypt) automatic TLS.";
      };
      forceSSL = mkOption {
        type = types.bool;
        default = false;
        description = "Redirect HTTP to HTTPS.";
      };
      uploadMaxBodySize = mkOption {
        type = types.str;
        default = "10m";
        description = "Maximum upload body size.";
      };
      extraConfig = mkOption {
        type = types.lines;
        default = "";
        description = "Extra nginx configuration.";
      };
    };
  };

  config = mkIf cfg.enable {
    environment.systemPackages = [ tududiPackage ];

    users.users.tududi = {
      isSystemUser = true;
      group = "tududi";
    };

    users.groups.tududi = {};

    systemd.tmpfiles.rules = [
      "d ${cfg.stateDir} 0750 tududi tududi -"
      "d ${cfg.stateDir}/db 0750 tududi tududi -"
      "d ${cfg.uploadPath} 0750 tududi tududi -"
    ];

    systemd.services.tududi = {
      description = "Tududi Task Management System";
      after = [ "network.target" ];
      wantedBy = [ "multi-user.target" ];

      serviceConfig = {
        Type = "simple";
        User = "tududi";
        Group = "tududi";
        WorkingDirectory = "${tududiPackage}/libexec/tududi";
        ExecStart = "${tududiCmd}";
        Restart = "on-failure";
        RestartSec = "10s";
        StateDirectory = "tududi";
        StateDirectoryMode = "0750";
        UMask = "0027";

        NoNewPrivileges = true;
        ProtectSystem = "strict";
        ProtectHome = true;
        PrivateTmp = true;
        ReadWritePaths = [ cfg.stateDir cfg.uploadPath ];
        PrivateDevices = true;
        ProtectKernelTunables = true;
        ProtectKernelModules = true;
        ProtectControlGroups = true;
        MemoryDenyWriteExecute = false;
      };
    };

    services.nginx = mkIf cfg.nginx.enable {
      virtualHosts."${cfg.nginx.serverName}" = {
        serverName = cfg.nginx.serverName;
        serverAliases = cfg.nginx.serverAliases;

        locations."/" = {
          proxyPass = "http://127.0.0.1:${toString cfg.port}";
          proxyWebsockets = true;
          extraConfig = ''
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            client_max_body_size ${cfg.nginx.uploadMaxBodySize};
          '';
        };

        enableACME = cfg.nginx.enableACME;
        forceSSL = cfg.nginx.forceSSL;
        listen = mkIf (cfg.nginx.listenAddress != null) [
          { addr = cfg.nginx.listenAddress; }
        ];
        extraConfig = cfg.nginx.extraConfig;
      };
    };
  };
}
