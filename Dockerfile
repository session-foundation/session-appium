FROM android-emulator-base



#=========================
# Copying Scripts to root
#=========================

RUN chmod a+x /session-appium/docker/*.sh
RUN ln -s /session-appium/docker/dl.sh  /usr/bin/dl && ln -s /session-appium/docker/test.sh /usr/bin/ci_test && ln -s /session-appium/docker/dl_and_test.sh /usr/bin/dl_and_test



WORKDIR /session-appium

EXPOSE 8080

COPY avd /root/.android/avd

ENTRYPOINT [ "/usr/bin/supervisord", "-c", "/etc/supervisord_test.conf", "-n" ]
