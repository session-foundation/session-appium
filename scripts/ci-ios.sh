# #!/bin/bash

# SIMULATOR_DEVICE="iPhone 15 Pro Max"
# SIMULATOR_OS="18.2"

# # Define an array of uppercase words for simulator names
# NUMBER_WORDS=("FIRST" "SECOND" "THIRD" "FOURTH" "FIFTH" "SIXTH" "SEVENTH" "EIGHTH" "NINTH" "TENTH" "ELEVENTH" "TWELFTH")

# # Function to boot simulators from environment variables
# function start_simulators_from_env_iOS() {
#     echo "Starting iOS simulators from environment variables..."

#     for i in {1..12}; do
#         simulator_label=${NUMBER_WORDS[$((i - 1))]}
#         env_var="IOS_${simulator_label}_SIMULATOR"
#         simulator_udid=$(printenv "$env_var")

#         if [[ -n "$simulator_udid" ]]; then
#             echo "Booting $simulator_label simulator: $simulator_udid"
#             xcrun simctl boot "$simulator_udid"
#         else
#             echo "Skipping $simulator_label simulator (not set)"
#             exit 1
#         fi
#     done

#     echo "Opening iOS Simulator app..."
#     open -a Simulator
# }

# # Function to start the Appium server
# function start_appium_server_iOS() {
#     echo "Starting Appium server..."
#     cd forked-session-appium || exit 1
#     start-server
# }

# # Function to stop running simulators
# function stop_simulators_from_env_iOS() {
#     echo "Stopping iOS simulators from environment variables..."

#     for i in {1..12}; do
#         simulator_label=${NUMBER_WORDS[$((i - 1))]}
#         env_var="IOS_${simulator_label}_SIMULATOR"
#         simulator_udid=$(printenv "$env_var")

#         if [[ -n "$simulator_udid" ]]; then
#             # Check if the simulator is running
#             if xcrun simctl list devices booted | grep -q "$simulator_udid"; then
#                 echo "Stopping $simulator_label simulator: $simulator_udid"
#                 xcrun simctl shutdown "$simulator_udid"
#             else
#                 echo "$simulator_label simulator is not running or does not exist."
#                 exit 1
#             fi
#         else
#             echo "Skipping $simulator_label simulator (not set)"
#             exit 1
#         fi
#     done
# }
# 