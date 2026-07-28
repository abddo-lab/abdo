#!/bin/bash
# N8N Instance Deployment Script
# Deploys and manages N8N instances for users

set -e

N8N_DIR="/home/crime/n8n"
INSTANCES_DIR="/home/crime/n8n-instances"
LOGS_DIR="/home/crime/n8n-logs"

# Create directories
mkdir -p "$INSTANCES_DIR" "$LOGS_DIR"

# ─── Functions ───

# Create a new instance for a user
create_instance() {
  local user_id=$1
  local workflow_name=$2
  local port=$3
  
  local instance_dir="$INSTANCES_DIR/$user_id"
  
  if [ -d "$instance_dir" ]; then
    echo "Instance already exists for user $user_id"
    return 1
  fi
  
  echo "Creating instance for user $user_id on port $port..."
  
  # Copy N8N to instance directory
  cp -r "$N8N_DIR" "$instance_dir"
  
  # Create instance-specific environment
  cat > "$instance_dir/.env" << EOF
N8N_EDITOR_BASE_URL=http://localhost:$port
N8N_HOST=0.0.0.0
N8N_PORT=$port
N8N_PROTOCOL=http
N8N_DEFAULT_NAME=$workflow_name

# AI Configuration
CARET_API_URL=http://crate.ftp.sh/v1
CARET_API_KEY=mr-e7eacfbc9e634bb2847e87b0
CARET_AI_MODEL=claude-fable-5

# Instance-specific settings
N8N_USER_ID=$user_id
N8N_INSTANCE_DIR=$instance_dir
EOF
  
  # Install dependencies
  cd "$instance_dir"
  pnpm install --frozen-lockfile 2>&1 | tee "$LOGS_DIR/$user_id-install.log"
  
  # Build
  pnpm build 2>&1 | tee "$LOGS_DIR/$user_id-build.log"
  
  echo "Instance created for user $user_id"
}

# Start an instance
start_instance() {
  local user_id=$1
  
  local instance_dir="$INSTANCES_DIR/$user_id"
  local log_file="$LOGS_DIR/$user_id.log"
  
  if [ ! -d "$instance_dir" ]; then
    echo "Instance not found for user $user_id"
    return 1
  fi
  
  # Check if already running
  if pgrep -f "n8n.*$user_id" > /dev/null; then
    echo "Instance already running for user $user_id"
    return 0
  fi
  
  echo "Starting instance for user $user_id..."
  
  # Start N8N in background
  cd "$instance_dir"
  nohup pnpm start > "$log_file" 2>&1 &
  
  # Save PID
  echo $! > "$instance_dir/.pid"
  
  echo "Instance started for user $user_id (PID: $!)"
}

# Stop an instance
stop_instance() {
  local user_id=$1
  
  local instance_dir="$INSTANCES_DIR/$user_id"
  
  if [ ! -d "$instance_dir" ]; then
    echo "Instance not found for user $user_id"
    return 1
  fi
  
  local pid_file="$instance_dir/.pid"
  
  if [ -f "$pid_file" ]; then
    local pid=$(cat "$pid_file")
    if kill -0 "$pid" 2>/dev/null; then
      echo "Stopping instance for user $user_id (PID: $pid)..."
      kill "$pid"
      rm -f "$pid_file"
      echo "Instance stopped for user $user_id"
    else
      echo "Instance not running for user $user_id"
      rm -f "$pid_file"
    fi
  else
    echo "No PID file found for user $user_id"
  fi
}

# Delete an instance
delete_instance() {
  local user_id=$1
  
  local instance_dir="$INSTANCES_DIR/$user_id"
  
  if [ ! -d "$instance_dir" ]; then
    echo "Instance not found for user $user_id"
    return 1
  fi
  
  # Stop if running
  stop_instance "$user_id"
  
  # Remove directory
  rm -rf "$instance_dir"
  
  echo "Instance deleted for user $user_id"
}

# Get instance status
get_status() {
  local user_id=$1
  
  local instance_dir="$INSTANCES_DIR/$user_id"
  
  if [ ! -d "$instance_dir" ]; then
    echo "not_found"
    return 1
  fi
  
  local pid_file="$instance_dir/.pid"
  
  if [ -f "$pid_file" ]; then
    local pid=$(cat "$pid_file")
    if kill -0 "$pid" 2>/dev/null; then
      echo "running"
    else
      echo "stopped"
    fi
  else
    echo "stopped"
  fi
}

# Get instance port from .env file
get_port() {
  local user_id=$1
  
  local instance_dir="$INSTANCES_DIR/$user_id"
  local env_file="$instance_dir/.env"
  
  if [ -f "$env_file" ]; then
    grep "N8N_PORT" "$env_file" | cut -d= -f2
  else
    echo "5678"
  fi
}

# ─── Main ───

case "$1" in
  create)
    create_instance "$2" "$3" "$4"
    ;;
  start)
    start_instance "$2"
    ;;
  stop)
    stop_instance "$2"
    ;;
  delete)
    delete_instance "$2"
    ;;
  status)
    get_status "$2"
    ;;
  port)
    get_port "$2"
    ;;
  *)
    echo "Usage: $0 {create|start|stop|delete|status|port} user_id [workflow_name] [port]"
    exit 1
    ;;
esac
