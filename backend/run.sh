#!/bin/bash

# Create a virtual environment if it doesn't exist
if [ ! -d "../.venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv ../.venv
fi

# Activate the virtual environment
source ../.venv/bin/activate

# Install requirements
echo "Installing requirements..."
pip install -r requirements.txt

# Run the Flask application
echo "Starting Flask server..."
flask run --host=0.0.0.0 --port=5000