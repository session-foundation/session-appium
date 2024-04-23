# syntax=docker.io/docker/dockerfile:1.7-labs

FROM openjdk:18-ea-11-jdk-slim-bullseye

LABEL maintainer "Amr Salem"

ENV DEBIAN_FRONTEND noninteractive

WORKDIR /
#=============================
# Install Dependenices
#=============================
SHELL ["/bin/bash", "-c"]

RUN apt-get update
RUN apt install -y ca-certificates curl git cpu-checker supervisor vim bash wget unzip
# openjdk-18-jdk-headless


#==============================
# Android SDK ARGS
#==============================
ARG ARCH="x86_64"
ARG TARGET="google_apis_playstore"
ARG API_LEVEL="34"
ARG BUILD_TOOLS="34.0.0"
ARG ANDROID_ARCH=${ANDROID_ARCH_DEFAULT}
ARG ANDROID_API_LEVEL="android-${API_LEVEL}"
ARG ANDROID_APIS="${TARGET};${ARCH}"
ARG EMULATOR_PACKAGE="system-images;${ANDROID_API_LEVEL};${ANDROID_APIS}"
ARG PLATFORM_VERSION="platforms;${ANDROID_API_LEVEL}"
ARG BUILD_TOOL="build-tools;${BUILD_TOOLS}"
ARG ANDROID_CMD="commandlinetools-linux-11076708_latest.zip"
ARG ANDROID_SDK_PACKAGES="${EMULATOR_PACKAGE} ${PLATFORM_VERSION} ${BUILD_TOOL} platform-tools"

#==============================
# Set JAVA_HOME - SDK
#==============================
ENV ANDROID_SDK_ROOT=/opt/android
ENV PATH "$PATH:$ANDROID_SDK_ROOT/cmdline-tools/tools:$ANDROID_SDK_ROOT/cmdline-tools/tools/bin:$ANDROID_SDK_ROOT/emulator:$ANDROID_SDK_ROOT/tools/bin:$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/build-tools/${BUILD_TOOLS}"
ENV DOCKER="true"

#============================================
# Install required Android CMD-line tools
#============================================
RUN wget https://dl.google.com/android/repository/${ANDROID_CMD} -P /tmp && \
              unzip -d $ANDROID_SDK_ROOT /tmp/$ANDROID_CMD && \
              mkdir -p $ANDROID_SDK_ROOT/cmdline-tools/tools && cd $ANDROID_SDK_ROOT/cmdline-tools &&  mv NOTICE.txt source.properties bin lib tools/  && \
              cd $ANDROID_SDK_ROOT/cmdline-tools/tools && ls

#============================================
# Install required package using SDK manager
#============================================
RUN yes Y | sdkmanager --licenses
RUN yes Y | sdkmanager --verbose --no_https ${ANDROID_SDK_PACKAGES}

#============================================
# Create required emulators
#============================================
ARG EMULATOR_NAME_1="emulator1"
ARG EMULATOR_NAME_2="emulator2"
ARG EMULATOR_NAME_3="emulator3"
ARG EMULATOR_NAME_4="emulator4"

ENV EMULATOR_NAME_1=$EMULATOR_NAME_1
ENV EMULATOR_NAME_2=$EMULATOR_NAME_2
ENV EMULATOR_NAME_3=$EMULATOR_NAME_3
ENV EMULATOR_NAME_4=$EMULATOR_NAME_4

ARG EMULATOR_DEVICE="pixel_6" # all emulators are created with the pixel 6 spec for now
ENV DEVICE_NAME=$EMULATOR_DEVICE
RUN yes | sdkmanager emulator

RUN echo "no" | avdmanager --verbose create avd --force --name "${EMULATOR_NAME_1}" --device "${EMULATOR_DEVICE}" --package "${EMULATOR_PACKAGE}"
RUN echo "no" | avdmanager --verbose create avd --force --name "${EMULATOR_NAME_2}" --device "${EMULATOR_DEVICE}" --package "${EMULATOR_PACKAGE}"
RUN echo "no" | avdmanager --verbose create avd --force --name "${EMULATOR_NAME_3}" --device "${EMULATOR_DEVICE}" --package "${EMULATOR_PACKAGE}"
RUN echo "no" | avdmanager --verbose create avd --force --name "${EMULATOR_NAME_4}" --device "${EMULATOR_DEVICE}" --package "${EMULATOR_PACKAGE}"

RUN avdmanager list devices
RUN avdmanager list avds

#==========================
# Install node & yarn berry
#==========================

RUN curl -sL https://deb.nodesource.com/setup_18.x | bash && \
    apt-get -qqy install nodejs && npm install -g yarn && corepack enable && \
    yarn set version 4.1.1


RUN apt install -y xvfb x11vnc fluxbox xterm novnc net-tools htop libpulse-dev libnss3

# Install websokify and noVNC
RUN curl -O https://bootstrap.pypa.io/get-pip.py && \
    python3 get-pip.py && \
    pip3 install --no-cache-dir \
        setuptools && \
    pip3 install -U https://github.com/novnc/websockify/archive/refs/tags/v0.11.0.tar.gz

RUN wget -O x11vnc.zip https://github.com/x11vnc/noVNC/archive/refs/heads/x11vnc.zip && \
     unzip x11vnc.zip && mv noVNC-x11vnc /usr/local/noVNC/ && ls -la /usr/local/noVNC/utils && \
    (chmod a+x /usr/local/noVNC/utils/launch.sh || \
        (chmod a+x /usr/local/noVNC/utils/novnc_proxy && \
         ln -s -f /usr/local/noVNC/utils/novnc_proxy /usr/local/noVNC/utils/launch.sh)) && \
    rm -rf /tmp/* /var/tmp/*


ENV HOME=/root \
    DEBIAN_FRONTEND=noninteractive \
    LANG=en_US.UTF-8 \
    LANGUAGE=en_US.UTF-8 \
    LC_ALL=C.UTF-8 \
    DISPLAY=:0.0 \
    DISPLAY_WIDTH=1024 \
    DISPLAY_HEIGHT=768 \
    RUN_XTERM=yes \
    RUN_FLUXBOX=yes


#==========================
# copy the appium current folder
#==========================

COPY --exclude="node_modules" --exclude=".git" --exclude="config/local*" ./ /session-appium


ADD docker/etc /etc


#===================
# Ports
#===================
ENV APPIUM_PORT=4723

#=========================
# Copying Scripts to root
#=========================

RUN chmod a+x /session-appium/docker/start_vnc.sh && \
    chmod a+x /session-appium/docker/start_emu.sh && \
    chmod a+x /session-appium/docker/start_appium.sh && \
    chmod a+x /session-appium/docker/start_emu_headless.sh && \
    chmod a+x /session-appium/docker/start_4_emus.sh && \
    chmod a+x /session-appium/docker/dl.sh && \
    chmod a+x /session-appium/docker/test.sh

RUN ln -s /session-appium/docker/dl.sh  /usr/bin/dl
RUN ln -s /session-appium/docker/test.sh /usr/bin/ci_test


WORKDIR /session-appium

#=======================
# framework entry point
#=======================
# CMD [ "/bin/bash" ]

CMD ["/usr/bin/supervisord","-c","/etc/supervisord.conf"]

EXPOSE 8080


RUN apt install -y libxcursor1 libasound2 libqt5gui5 libc++-dev libxcb-cursor0
