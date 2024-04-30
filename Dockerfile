FROM android-refresh-emulator

CMD [ "/bin/bash" ]


# COPY avd /root/.android/avd

# run this to start the supervisord (and the emulators)
# /usr/bin/supervisord -c /etc/supervisord.conf


#=========================
# Copying Scripts to root
#=========================

RUN chmod a+x /session-appium/docker/*.sh
RUN ln -s /session-appium/docker/dl.sh  /usr/bin/dl
RUN ln -s /session-appium/docker/test.sh /usr/bin/ci_test
RUN ln -s /session-appium/docker/dl_and_test.sh /usr/bin/dl_and_test



WORKDIR /session-appium

EXPOSE 8080