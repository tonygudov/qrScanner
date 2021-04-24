const qrScanner = {
		
  reset () {

  	qrScanner.scanner = null;
  	qrScanner.canvasElement = null;
  	qrScanner.cancelElement = null;
  	qrScanner.progressElement = null;
  	qrScanner.logElement = null;
  	qrScanner.video = null;
  	qrScanner.scanning = false;
  	qrScanner.exclude = [];
  	qrScanner.success = function () {};
  	qrScanner.regex = /.?/;
  	qrScanner.scanTwise = true;

	  qrScanner.progress = 0;
  	qrScanner.frames = 0;
  	qrScanner.codeMinFrames = 10;
  	qrScanner.tempCode = null;
  	qrScanner.tempCodeStartFrames = 0;
	  qrScanner.lastCode = null;
	  qrScanner.pauseFrames = 0;
	  qrScanner.frameOffset = 100;

	  qrScanner.message = null;
  	qrScanner.messageElement = null;
  	qrScanner.messageFrames = 0;
	  qrScanner.debug = false;
  },

  init ( options ) {

  	qrScanner.reset();

    if ( options ) {

    	for ( const [key, value] of Object.entries( options ) )
				qrScanner[ key ] = value;
    }

    navigator.mediaDevices.getUserMedia( { video: { facingMode: 'environment' } } )
	    .then( function( stream ) {

	      qrScanner.scan( stream );

	    } )
	    .catch( function( err ) {

			  qrScanner.destroy();
			} );
  },
  
  scan ( stream ) {

    qrScanner.pauseFrames = qrScanner.frames + qrScanner.frameOffset;

  	qrScanner.scanner = $( '\
  		<div id="qrScanner">\
  			<canvas id="qrScannerCanvas"></canvas>\
				<div class="progress">\
					<div id="qrScannerProgress" class="progress-bar bg-success"></div>\
				</div>\
				<span id="qrScannerCancel" class="btn btn-danger btn-lg">Cancel</span>\
				<div id="qrScannerGuide"></div>\
				<div id="qrScannerMessage">Test</div>\
			</div>' );

    $( 'body' ).append( qrScanner.scanner );

    qrScanner.scanner = $( '#qrScanner' );
    qrScanner.canvasElement = $( '#qrScannerCanvas' );
    qrScanner.cancelElement = $( '#qrScannerCancel' );
    qrScanner.progressElement = $( '#qrScannerProgress' );
    qrScanner.messageElement = $( '#qrScannerMessage' );

   	qrScanner.canvas = qrScanner.canvasElement[0].getContext( '2d' );
    qrScanner.video = document.createElement( 'video' );

    qrScanner.cancelElement.click ( function () {

    	qrScanner.destroy();
    } );

    qrScanner.video.srcObject = stream;
    qrScanner.video.setAttribute( 'playsinline', true ); // required to tell iOS safari we don't want fullscreen
    qrScanner.video.play();

    qrScanner.scanning = true;

    if ( qrScanner.debug ) {

    	qrScanner.logElement = $( '<div id="qrScannerLog"></div>' );
    	qrScanner.scanner.append( qrScanner.logElement );
    }

    requestAnimationFrame( qrScanner.tick );
  },

  tick () {

    if ( qrScanner.video && qrScanner.video.readyState === qrScanner.video.HAVE_ENOUGH_DATA ) {

			qrScanner.frames++;

			if ( qrScanner.frames >= qrScanner.messageFrames )
      	qrScanner.closeMessage();

      var windowWidth = $( window ).width(),
      		windowHeight = $( window ).height(),
      		videoRatio = qrScanner.video.videoHeight / qrScanner.video.videoWidth,
      		imageWidth = windowWidth,
      		imageHeight = videoRatio * imageWidth;

      if ( imageHeight < windowHeight ) {

      	imageHeight = windowHeight;
      	imageWidth = imageHeight / videoRatio;
      }

      var x = windowWidth / 2 - imageWidth / 2,
      		y = windowHeight / 2 - imageHeight / 2;

      qrScanner.canvasElement.attr( 'width', windowWidth );
      qrScanner.canvasElement.attr( 'height', windowHeight );

      qrScanner.canvas.drawImage( qrScanner.video, x, y, imageWidth, imageHeight );

      var imageDataRatioFromWidth = 0.5,
      		imageDataWidth = windowWidth * imageDataRatioFromWidth,
      		imageDataHeight = imageDataWidth;

      if ( imageDataHeight > windowHeight * imageDataRatioFromWidth ) {

      	imageDataHeight = windowHeight * imageDataRatioFromWidth;
      	imageDataWidth = imageDataHeight;
      }

      var imageData = qrScanner.canvas.getImageData( windowWidth / 2 - imageDataWidth / 2, windowHeight * 0.4 - imageDataHeight / 2, imageDataWidth, imageDataHeight );

      if ( qrScanner.debug )
      	qrScanner.canvas.putImageData( imageData, 0, 0 );

      if ( qrScanner.scanning && qrScanner.frames > qrScanner.pauseFrames ) {

      	var code = jsQR( imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" } );

        if ( code ) {

        	if ( qrScanner.regex.test( code.data ) ) {

        		if ( !qrScanner.exclude.includes( code.data ) ) {

	        		if ( qrScanner.tempCode != code.data ) {

				  			qrScanner.setTempCode( code.data );

	        		} else {

								if ( qrScanner.frames - qrScanner.tempCodeStartFrames >= qrScanner.codeMinFrames ) {

			        		if ( qrScanner.lastCode == code.data || qrScanner.scanTwise == false ) {

					          qrScanner.success( code.data );
					          qrScanner.destroy();

					          return;

					        } else {

					        	if ( qrScanner.lastCode == null ) {

					        		qrScanner.openMessage( 'Scan again', 'success' );
					        		qrScanner.lastCode = code.data;

					        	} else {

					        		qrScanner.openMessage( 'Wrong code', 'error' );
					        	}

					        	qrScanner.setTempCode( null );

					        	qrScanner.pauseFrames = qrScanner.frames + qrScanner.frameOffset;
					        }
					      }
					    }

					  } else {
        		
        			qrScanner.openMessage( 'Scan another code', 'warning' );
			  			qrScanner.setTempCode( null );
        		}

	        } else {
        	
			  		qrScanner.setTempCode( null );
        	}

        } else {

			  	qrScanner.setTempCode( null );
        }

      } else {

			  qrScanner.setTempCode( null );
      }

			qrScanner.setProgress();
    }

    if ( qrScanner.scanning )
    	requestAnimationFrame( qrScanner.tick );

    if ( qrScanner.debug )
    	qrScanner.log();
  },

  setTempCode ( code ) {

  	qrScanner.tempCode = code;
  	qrScanner.tempCodeStartFrames = qrScanner.frames;
  },

  openMessage ( message, type ) {

  	qrScanner.closeMessage();

  	qrScanner.messageElement.html( message );
  	qrScanner.messageElement.show();

  	if ( type )
  		qrScanner.messageElement.addClass( type );

  	qrScanner.messageFrames = qrScanner.frames + qrScanner.frameOffset;
  },

  closeMessage () {

  	qrScanner.messageElement.html( '' );
  	qrScanner.messageElement.hide();
  	qrScanner.messageElement.removeClass( 'success error warning' );
  	qrScanner.messageFrames = 0;
  },

  setProgress () {

  	if ( qrScanner.frames == qrScanner.tempCodeStartFrames )
  		qrScanner.progress = 0;
  	else
  		qrScanner.progress = Math.min( 100,( ( qrScanner.frames - qrScanner.tempCodeStartFrames ) / qrScanner.codeMinFrames ) * 100 );

  	qrScanner.progressElement.css( 'width', qrScanner.progress + '%' );

  	if ( qrScanner.progress )
  		qrScanner.progressElement.parent().show();
  	else
  		qrScanner.progressElement.parent().hide();
  },

  log () {

		qrScanner.logElement.html( 'frames: ' + qrScanner.frames + '<br>progress: ' + qrScanner.progress + '<br>lastCode: ' + qrScanner.lastCode + '<br>tempCode: ' + qrScanner.tempCode + '<br>tempCodeStartFrames: ' + qrScanner.tempCodeStartFrames + '<br>codeMinFrames: ' + qrScanner.codeMinFrames );
  },

  destroy () {

  	if ( qrScanner.video !== null && qrScanner.video.srcObject !== null ) {

	    qrScanner.video.srcObject.getTracks().forEach( function( track ) {

			  track.stop();
			} );
		}

		if ( qrScanner.video !== null )
    	qrScanner.video.remove();

		if ( qrScanner.scanner !== null )
			qrScanner.scanner.remove();

    qrScanner.reset();
  }

};
