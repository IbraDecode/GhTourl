#!/bin/bash

# GitHub To URL Bot Starter Script

echo "Starting GitHub To URL Bot..."

# Load environment variables from .env if exists
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Run the bot
node index.js