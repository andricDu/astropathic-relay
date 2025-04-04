export const SSHUTTLE_COMMAND = "sshuttle";

export const DEFAULT_OPTIONS = {
  remote: "user@remote-server",
  local: "0.0.0.0/0",
  port: 22,
  verbose: false,
};

export const buildSshuttleCommand = (options = {}) => {
  const { remote, local, port, verbose } = { ...DEFAULT_OPTIONS, ...options };
  let command = `${SSHUTTLE_COMMAND} -r ${remote} ${local}`;

  if (port) {
    command += ` --port ${port}`;
  }

  if (verbose) {
    command += " -v";
  }

  return command;
};