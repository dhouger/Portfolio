(function () {
    'use strict';


    var streamManagerPort = WinJS.Class.define(function (streamManager, captionManager) {
        this._streamManager = streamManager;
        this._captionManager = captionManager;
        this.selectedCaptionStream = null;
        this.availableCaptionStreams = [];
        this.isLive = null;
        this._managerTimeChangedBind = this._managerTimeChanged.bind(this);
        this._streamManager.addEventListener('adaptivesourcestatusupdatedevent', this._managerTimeChangedBind);
        this._failedEventBind = this._failedEvent.bind(this);
        this._restartPoint = null;
        this._streamManager.addEventListener('adaptivesourcefailedevent', this._failedEventBind);
        this._streamCode = [
            "GamepadDPadUp",
            "GamepadDPadUp",
            "GamepadDPadDown",
            "GamepadDPadDown",
            "GamepadDPadLeft",
            "GamepadDPadRight",
            "GamepadDPadLeft",
            "GamepadDPadRight",
            "GamepadY",
            "GamepadX",
        ];
        this._streamCodeCount = 0;
        var that = this;
        document.addEventListener("keyup", function (e) {
            if (e.key === that._streamCode[that._streamCodeCount]) {
                that._streamCodeCount++;
                if (that._streamCodeCount === that._streamCode.length) {
                    var streamTimeCounter = document.querySelector("#stream-time-counter");
                    if (streamTimeCounter) {
                        WinJS.Utilities.removeClass(streamTimeCounter, 'win-hidden');
                    }
                    that._streamCodeCount = 0;
                }
            } else {
                that._streamCodeCount = 0;
            }
        });

    }, {
        isCaptionStream: function (stream) {
            return stream.type === Microsoft.Media.AdaptiveStreaming.MediaStreamType.text
                && (stream.subType === "CAPT" || stream.subType === "SUBT");
        },
        gotManifest: function (manifest, vodStart, vodEnd) {
            var i = 0, that = this;
            this.availableCaptionStreams = [];
            this.isLive = manifest.isLive;
            for (i = 0; i < manifest.availableStreams.length; ++i) {
                if (this.isCaptionStream(manifest.availableStreams[i])) {
                    this.availableCaptionStreams.push(manifest.availableStreams[i]);
                }
            }

            var startTime = manifest.startTime;
            var endTime = startTime + manifest.duration;
            var livePosition = endTime;

            this._captionManager._startTime = PlayerFramework.Utilities.convertTicksToSeconds(startTime);
            this._captionManager._endTime = PlayerFramework.Utilities.convertTicksToSeconds(endTime);
            this._captionManager._liveTime = PlayerFramework.Utilities.convertTicksToSeconds(livePosition);

            this._setYet = false;

            if (!that.isLive && that._mediaPlayer && that._mediaPlayer._mediaElementAdapter && that._captionManager._startTime !== 0) {
                that._captionManager._hasAlreadySetVODStartAndEndTimes = true;
                if (vodEnd) {
                    that._mediaPlayer.endTime = that._captionManager._startTime + parseInt(vodEnd, 10);
                } else {
                    that._mediaPlayer.endTime = that._captionManager._endTime;
                }
                if (vodStart) {
                    that._mediaPlayer.startTime = that._captionManager._startTime + parseInt(vodStart, 10);
                } else {
                    that._mediaPlayer.startTime = that._captionManager._startTime;
                }
                that._mediaPlayer.mediaElementAdapter.mediaElement.play();
            }
        },
        onDataRecieved: function (dataEventArgs) {
            var i = dataEventArgs;
            this._captionManager._streamDataReceivedHandler(i);
        },

        tryMove: function (stream, track, chunkIter, newData) {
            var that = this;
            if (chunkIter.moveNext()) {
                console.log("MOVED NEXT");
                return that.pollFragmentAsync(stream, track, chunkIter, newData);
            } else {
                console.log("MOVING FAILED");
                return WinJS.Promise.timeout(1000).then(function () { //Sleep a while then try again
                    return that.tryMove(stream, track, chunkIter, newData);
                });
            }
        },

        runWithWatchDog: function (promise, timeout) {
            //return WinJS.Promise.wrap(null).then(function () {
            //    var promiseComplete = false, subPromises = [];
            //    subPromises.push(promise.then(function (data) {
            //        return [data];
            //    }));
            //    subPromises.push(WinJS.Promise.timeout(timeout).then(function () {
            //        promise.cancel();
            //        return WinJS.Promise.wrapError("FAILED");
            //    }));
            //    return WinJS.Promise.any(subPromises).then(function (data) {
            //        if (typeof data.value.then === "function") {
            //            return data.value.then(function (dataArray) {
            //                return dataArray[0];
            //            });
            //        }
            //        return data;
            //    });
            //});

            return WinJS.Promise.timeout(timeout, promise.then(function (c) {
                return WinJS.Promise.wrap(c);
            }, function (e) {
                return WinJS.Promise.wrapError("watchdog");
            }));
        },

        pollFragmentAsync: function (stream, track, chunkIter, previousData) {
            var that = this;
            if (that.invalidateCaptions) {
                chunkIter = that.getNewChunkIterator(stream);
                that.invalidateCaptions = false;
            }
            console.log("GETTING CHUNK Data [" + chunkIter + "]");
            return stream.getChunkDataAsync(chunkIter, track).then(function (chunkDataBuffer) {
                console.log("GETTING CHUNK Info ASYNC");
                return stream.getChunkInfoAsync(chunkIter).then(function (chunkInfo) {
                    console.log("GOT CHUNK Data & Info");
                    var diff = chunkInfo.chunkTime - (that.getMediaPlayerTimeInTicks() + 600000000);
                    if (diff > 0 && that.getMediaPlayerTimeInTicks() && previousData) {
                        that.timeoutPromise = WinJS.Promise.timeout(((diff / 10000000) - 10) * 1000);
                    } else {
                        that.timeoutPromise = WinJS.Promise.timeout(0);
                    }
                    if (previousData) {
                        console.log("GOT CHUNK INFO - PREV DATA");
                        previousData.endTime = chunkInfo.chunkTime;
                        that.onDataRecieved(previousData);
                    } else {
                        console.log("GOT CHUNK INFO - NEW (ONCE)");
                    }
                    console.log("GOT CHUNK DATA ASYNC");
                    var chunkData = Windows.Security.Cryptography.CryptographicBuffer.copyToByteArray(chunkDataBuffer), newData = null;

                    newData = {
                        data: chunkData,
                        startTime: chunkInfo.chunkTime,
                        stream: stream,
                        track: track
                    };
                    return that.timeoutPromise.then(function () {
                        that.timeoutPromise = null;
                        return that.tryMove(stream, track, chunkIter, newData);
                    }, function cancelled(c) {
                        if (that.invalidateCaptions) {
                            chunkIter.movePrev();
                            return that.pollFragmentAsync(stream, track, chunkIter, newData);
                        }
                        return WinJS.Promise.wrapError("cancelled_noretry");
                    });
                });
            }, function (e) {
                return WinJS.Promise.wrapError("retry");
            });
        },

        pollFragmentAsyncOLD: function (stream, track, chunkIter, previousData) {
            var that = this;
            if (that.invalidateCaptions) {
                chunkIter = that.getNewChunkIterator(stream);
                that.invalidateCaptions = false;
            }
            console.log("GETTING CHUNK INFO [" + chunkIter + "]");
            return WinJS.Promise.timeout(0).then(function () {
                return that.runWithWatchDog(stream.getChunkInfoAsync(chunkIter), 1000);
            }).then(function (chunkInfo) {
                console.log("GOT CHUNK INFO");
                var diff = chunkInfo.chunkTime - (that.getMediaPlayerTimeInTicks() + 600000000);
                if (diff > 0 && that.getMediaPlayerTimeInTicks() && previousData)
                {
                    that.timeoutPromise = WinJS.Promise.timeout(((diff / 10000000) - 10) * 1000);
                } else {
                    that.timeoutPromise = WinJS.Promise.timeout(0);
                }
                if (previousData) {
                    console.log("GOT CHUNK INFO - PREV DATA");
                    previousData.endTime = chunkInfo.chunkTime;
                    that.onDataRecieved(previousData);
                } else {
                    console.log("GOT CHUNK INFO - NEW (ONCE)");
                }
                return that.timeoutPromise.then(function () {
                    console.log("GETTING CHUNK DATA ASYNC");
                    return WinJS.Promise.timeout(0).then(function () {
                        return that.runWithWatchDog(stream.getChunkDataAsync(chunkIter, track), 1000);
                    }).then(function (chunkDataBuffer) {
                        console.log("GOT CHUNK DATA ASYNC");
                        var chunkData = Windows.Security.Cryptography.CryptographicBuffer.copyToByteArray(chunkDataBuffer), newData = null;

                        newData = {
                            data: chunkData,
                            startTime: chunkInfo.chunkTime,
                            stream: stream,
                            track: track
                        };
                        return that.tryMove(stream, track, chunkIter, newData);
                    //}, function (e) {
                    //    chunkIter.movePrev();
                    //    return that.pollFragmentAsync(stream, track, chunkIter, null);
                    });
                }, function (e) {
                    return WinJS.Promise.wrapError("retry");
                });
            //}, function (e) {
                //console.log("ERROR - RETRY");
                //chunkIter.movePrev();
                //return that.pollFragmentAsync(stream, track, chunkIter, null);
            });
        },

        getNewChunkIterator: function (stream) {
            var now = this.getMediaPlayerTimeInTicks();
            try {
                if (this._mediaPlayer && this._mediaPlayer._mediaElementAdapter && this._mediaPlayer._mediaElementAdapter._mediaElement) {
                    return stream.getIterator(now - 700000000, now);
                } else {
                    return stream.firstInCurrentChunkList;
                }
            } catch (e) {
                return stream.firstInCurrentChunkList;
            }
        },

        getMediaPlayerTimeInTicks: function () {
            if (this._mediaPlayer && this._mediaPlayer._mediaElementAdapter && this._mediaPlayer._mediaElementAdapter._mediaElement) {
                return this._mediaPlayer._mediaElementAdapter._mediaElement.currentTime * 10000000;
            } else {
                return null;
            }
        },

        pollIsmtAsync: function (stream) {
            var captionTrack, that = this, iter = null;
            this.invalidateCaptions = false;
            if (!that.setupSekkedCallback) {
                this._mediaPlayer._mediaElementAdapter._mediaElement.addEventListener("seeked", function () {
                    that.invalidateCaptions = true;
                    if (that.timeoutPromise) {
                        that.timeoutPromise.cancel();
                        that.timeoutPromise = null;
                    }
                    that._captionManager.clearCaptions();
                });
                that.setupSekkedCallback = true;
            }
            if (stream && stream.availableTracks.length > 0) {
                captionTrack = stream.availableTracks[0];
                iter = that.getNewChunkIterator(stream); //stream.lastInCurrentChunkList;
                return that.pollFragmentAsync(stream, captionTrack, iter, null);
            }
            return WinJS.Promise.wrap(null);
        },

        kill: function () {
            if (this.pollingPromise) {
                this.pollingPromise.cancel();
                this.pollingPromise = null;
            }
        },

        setSelectedCaptionStream: function (value) {
            var selectedStreams = [], i = 0, oldCapStream = null, newCapStream = null, manifest = this._streamManager.adaptiveSources[0].manifest, that = this;
            if (manifest) {
                for (i = 0; i < manifest.selectedStreams.length; ++i) {
                    if (!this.isCaptionStream(manifest.selectedStreams[i])) {
                        selectedStreams.push(manifest.selectedStreams[i]);
                    } else {
                        oldCapStream = manifest.selectedStreams[i];
                    }
                }

                if (value) {
                    for (i = 0; i < manifest.availableStreams.length; ++i) {
                        if (this.isCaptionStream(manifest.availableStreams[i])) {
                            if (value.name && manifest.availableStreams[i].name && value.name === manifest.availableStreams[i].name) {
                                newCapStream = manifest.availableStreams[i];
                                selectedStreams.push(manifest.availableStreams[i]);
                                break;
                            }
                        }
                    }
                }

                if (that.pollingPromise) {
                    that.pollingPromise.cancel();
                    that.pollingPromise = null;
                }
                //This should be stored so we can cancel it!
                this.selectedCaptionStream = newCapStream; //ADDED
                that.pollingPromise = manifest.selectStreamsAsync(selectedStreams).then(function (e) {
                    return that.pollIsmtAsync(newCapStream);
                }).then(
                function (e) {
                    var i = e;
                }, function (e) {
                });
            }
        },

        _getTimeInHMS: function(timeInSecs) {
            var hours = 0, mins = 0, secs = 0;
            hours = Math.floor(timeInSecs / 3600);
            timeInSecs -= hours * 3600;
            mins = Math.floor(timeInSecs / 60);
            timeInSecs -= mins * 60;
            secs = timeInSecs;
            return (hours < 10 ? "0" + hours : hours) + ":" + (mins < 10 ? "0" + mins : mins) + ":" + (secs < 10 ? "0" + secs : secs);
        },

        _managerTimeChanged: function (e) {
            if (e && e.detail && e.detail[0] && e.detail[0].adaptiveSource && e.detail[0].adaptiveSource.manifest
                && e.detail[0].adaptiveSource.manifest.duration) {
                if (e.detail[0].updateType === Microsoft.Media.AdaptiveStreaming.AdaptiveSourceStatusUpdateType.startEndTime) {
                    var startTime = e.detail[0].startTime;
                    var endTime = e.detail[0].startTime + e.detail[0].adaptiveSource.manifest.duration;
                    if (e.detail[0].endTime > endTime) endTime = e.detail[0].endTime;
                    var livePosition = e.detail[0].endTime;

                    this._captionManager._startTime = PlayerFramework.Utilities.convertTicksToSeconds(startTime);
                    this._captionManager._endTime = PlayerFramework.Utilities.convertTicksToSeconds(endTime);
                    this._captionManager._liveTime = PlayerFramework.Utilities.convertTicksToSeconds(livePosition);

                    if (this._captionManager._isLive && this._mediaPlayer && this._mediaPlayer._markers) {
                        this._mediaPlayer.startTime = this._captionManager._startTime;
                        this._mediaPlayer.endTime = this._captionManager._endTime;
                        if (!this._setYet) {
                            try {
                                this._mediaPlayer.mediaElementAdapter.mediaElement.currentTime = this._captionManager._liveTime;
                                this._setYet = true;
                            } catch (e) {
                            }
                        }
                        this._mediaPlayer._mediaElementAdapter.liveTime = this._captionManager._liveTime;
                    }

                    var streamTimeCounter = document.querySelector("#stream-time-counter");
                    if (streamTimeCounter) {
                        streamTimeCounter.innerText = this._getTimeInHMS(this._captionManager._endTime);
                    }
                }
            }
        },
        addMinutes: function (date, minutes) {
            return new Date(date.getTime() + minutes*60000);
        },
        _failedEvent: function (e) {
            //Tell the video system that something bad happened
            var now = new Date(), src = null;
            if ((this._captionManager && this._captionManager._mediaPlayer && this._captionManager._mediaPlayer.mediaElementAdapter
                && this._captionManager._mediaPlayer.mediaElementAdapter.mediaElement && e.detail && e.detail[0] && e.detail[0].failType >= 308)
                && (!this._restartPoint))
            {
                if (!this._restartPoint) {
                    this._restartPoint = now;
                }
                var src = this._captionManager._mediaPlayer.mediaElementAdapter.mediaElement.src;
                this._captionManager._mediaPlayer.mediaElementAdapter.mediaElement.removeAttribute("src");
                this._captionManager._mediaPlayer.mediaElementAdapter.mediaElement.src = src.trim();
            } else {
                if (this.fatalErrorFn) {
                    this.fatalErrorFn("SMP");
                }
            }
        }
    });

    WinJS.Class.mix(streamManagerPort, WinJS.Utilities.eventMixin);

    WinJS.Namespace.define("Steve", {
        StreamManagerPort: streamManagerPort
    });
})();
