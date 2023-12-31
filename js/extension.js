(function() {
    class PhotoFrame extends window.Extension {
        constructor() {
            super('photo-frame');
            //console.log("Adding Photo frame to menu");
            this.addMenuEntry('Photo Frame');


            this.kiosk = false;
            if (document.getElementById('virtualKeyboardChromeExtension') != null) {
                document.body.classList.add('kiosk');
                this.kiosk = true;
            }

            this.debug = false;
            //console.log(window.API);
            this.content = '';
			this.get_init_error_counter = 0; // set to a higher number if the slow update failed
			this.poll_fail_count = 0; // set to a higher number if the voco actions update failed


            // Screensaver
			this.current_photo_number = 0;
			this.last_activity_time = new Date().getTime()
            this.screensaver_delay = 120;
            this.showing_screensaver = false;
            this.previous_last_activity_time = 0;
            this.screensaver_path = '/extensions/photo-frame';
            this.screensaver_ignore_click = false;

			
			
			

            // Printer
            this.peripage_printer_available = false;
			this.cups_printer_available = false;
			this.do_not_show_next_random_photo = false; // true when the print modal is open
			

            // Photo frame
            this.filenames = [];
            this.interval = 30;
            this.fit_to_screen = "mix";
            this.clock = false;
            this.show_date = false;
            this.interval_counter = 0; // if it reaches the interval value, then it will show another picture.
            this.current_picture = 1; // two pictures swap places: picture1 and picture2. This is for a smooth transition effect


            // Weather
            this.show_weather = false;
            this.weather_addon_exists = false;
            this.all_things = [];
            this.weather_thing_url = null;
			this.weather_fail_count = 0;


			// Swipe
			this.touchstartX = 0
			this.touchendX = 0


			// Voco timers
			this.show_voco_timers = false;
			this.voco_interval_counter = 6;
			
			this.action_times = [];

			// animations and effects
			this.greyscale = false;
			this.animations = true;

            fetch(`/extensions/${this.id}/views/content.html`)
                .then((res) => res.text())
                .then((text) => {
                    this.content = text;
                    if (document.location.href.endsWith("photo-frame")) {
                        this.show();
                    }
                })
                .catch((e) => console.error('Failed to fetch content:', e));


            // Check if screensaver should be active
            window.API.postJson(
                `/extensions/photo-frame/api/list`, {
                    'init': 1
                }

            ).then((body) => {
				console.log("photo frame early init body: ", body)
				if(typeof body.debug != 'undefined'){
					this.debug = body.debug;
				}
                
                if (this.debug) {
                    console.log("photo frame: early init response: ");
                    console.log(body);
                }

				
                if (typeof body.screensaver_delay != 'undefined') {
                    this.screensaver_delay = body.screensaver_delay;
                    if (body.screensaver_delay > 1) {
                        //console.log('photo-frame: calling start screensaver listeners');
                        this.start_screensaver_listeners();
                    }
				}
				
            }).catch((e) => {
                console.log("Photo frame: error in early init function: ", e);
            });


        }





		//
		//  SHOW
		//

        show() {
                //console.log("in photo frame show");

                if (this.content == '') {
                    return;
                } else {
                    this.view.innerHTML = this.content;
                }
				
				this.current_picture = 1;
				this.do_not_show_next_random_photo = false;


                //const pre = document.getElementById('extension-photo-frame-response-data');
                const thing_list = document.getElementById('extension-photo-frame-thing-list');


                if (this.kiosk) {
                    //console.log("fullscreen");
                    document.getElementById('extension-photo-frame-photos-file-selector').style.display = 'none';
                    document.getElementById('extension-photo-frame-photos-file-selector').outerHTML = "";
                    //document.getElementById('extension-photo-frame-dropzone').outerHTML = "";

                } else {
                    //console.log("Attaching file listeners");
                    document.getElementById("extension-photo-frame-photos-file-selector").addEventListener('change', () => {
                        var filesSelected = document.getElementById("extension-photo-frame-photos-file-selector").files;
                        this.upload_files(filesSelected);
                    });

                    this.createDropzoneMethods(); //  disabled, as files could be too big. For now users can just upload an image one at a time.
                }

                


                // EVENT LISTENERS

				// manage photos button
                document.getElementById("extension-photo-frame-more-button-container").addEventListener('click', () => {
                    event.stopImmediatePropagation();
                    const picture_holder = document.getElementById('extension-photo-frame-picture-holder');
                    const overview = document.getElementById('extension-photo-frame-overview');
					//this.interval_counter = 0;
                    //this.show_list();
					this.removeClass(overview, "extension-photo-frame-hidden");
                    this.addClass(picture_holder, "extension-photo-frame-hidden");
					
                });


				// next photo button
                document.getElementById("extension-photo-frame-next-photo-button-container").addEventListener('click', () => {
					if(this.debug){
						console.log("next photo button clicked");
					}
                    event.stopImmediatePropagation();
					event.preventDefault();
					this.interval_counter = 0
					this.last_activity_time = new Date().getTime();
					this.next_picture();
                });
				
				
				// start screensaver button
                document.getElementById("extension-photo-frame-start-screensaver-button").addEventListener('click', () => {
					if(this.debug){
						console.log("start screensaver button clicked");
					}
                    event.stopImmediatePropagation();
					event.preventDefault();
                    this.screensaver_ignore_click = true;
                    window.setTimeout(() => {
                        this.screensaver_ignore_click = false;
                    },1000);
					this.last_activity_time = new Date().getTime() - (this.screensaver_delay * 1001);
                });
				
				


				// Cups printer buttons
                document.getElementById("extension-photo-frame-print-button").addEventListener('click', () => {
					const proto_to_print = document.getElementById("extension-photo-frame-print-confirm-button").getAttribute('data-photo-name');
					this.do_not_show_next_random_photo = true;
					console.log("cups print photo button clicked");
                    event.stopImmediatePropagation();
					event.preventDefault();
					document.getElementById("extension-photo-frame-print-button-container").classList.add('extension-photo-frame-print-button-show-confirmation');
					
                    document.getElementById('extension-photo-frame-picture1').style.backgroundSize = "contain";
                    document.getElementById('extension-photo-frame-picture2').style.backgroundSize = "contain";
					
					/*
					setTimeout(() => {
						if(document.getElementById("extension-photo-frame-print-confirm-button").getAttribute('data-photo-name') == proto_to_print){
							
						}
						document.getelementById("extension-photo-frame-print-button-container").classList.remove('extension-photo-frame-print-button-show-confirmation');
						
						this.do_not_show_next_random_photo = false;
					},8000);
					*/
                });
				
				document.getElementById("extension-photo-frame-print-confirm-button").addEventListener('click', () => {
					console.log("cups really print photo button clicked");
                    event.stopImmediatePropagation();
					event.preventDefault();
					const photo_name = document.getElementById("extension-photo-frame-print-confirm-button").getAttribute('data-photo-name');
					console.log("photo name: ", photo_name);
					//this.do_not_show_next_random_photo = false;
					this.print_file( photo_name );
				});
				
				document.getElementById("extension-photo-frame-print-cancel-button").addEventListener('click', () => {
					console.log("cups cancel print photo button clicked");
                    event.stopImmediatePropagation();
					event.preventDefault();
					this.do_not_show_next_random_photo = false;
					document.getElementById("extension-photo-frame-print-button-container").classList.remove('extension-photo-frame-print-button-show-confirmation');
				});
				
				
				// Clicking on photo
                document.getElementById("extension-photo-frame-picture-holder").addEventListener('click', () => {
                    if (this.showing_screensaver == false) {
                        //var menu_button = document.getElementById("menu-button");
                        //menu_button.click(); //dispatchEvent('click');
                    }
					if(!this.screensaver_ignore_click){
						this.last_activity_time = new Date().getTime();
					}
					//this.next_photo();
                });
				
				
				document.getElementById("extension-photo-frame-add-random-photo-button").addEventListener('click', () => {
					if (this.debug) {
						console.log("add random photo button clicked");
					}
					window.API.postJson(
		                `/extensions/photo-frame/api/get_random`,
		            ).then((body) => {
		                if (this.debug) {
							console.log("get_random photo response: ", body);
						}
						if(typeof body['data'] != 'undefined'){
		                    this.filenames = body['data'];
		                    this.show_list(body['data']);
			                this.show_file(this.filenames[this.filenames.length-1]);
						}
		                
		            }).catch((e) => {
		                console.error("Photo frame: error doing get_random photo: ", e);
		            });
				});
				
				
				
   
				if(!document.getElementById("extension-photo-frame-picture-holder").classList.contains('extension-photo-frame-has-swipe-listener')){
					document.getElementById("extension-photo-frame-picture-holder").classList.add('extension-photo-frame-has-swipe-listener');
				
					document.getElementById("extension-photo-frame-picture-holder").addEventListener('touchstart', e => {
						if(this.debug){
							console.log("photo-frame: touch start");
						}
						this.touchstartX = e.changedTouches[0].screenX;
					}, {
                		passive: true
            		});

					document.getElementById("extension-photo-frame-picture-holder").addEventListener('touchend', e => {
						this.touchendX = e.changedTouches[0].screenX;
						this.check_swipe_direction();
					}, {
                		passive: true
            		});
				}
					
				
				
				// TIMER LOOP

                // Photo change interval
                this.photo_interval = setInterval(() => {
					
					this.interval_counter++;
					this.slow_interval_counter++
					
					
					// change to new random picture after X seconds
                    if (this.interval_counter > this.interval) {
						this.interval_counter = 0;
                        this.random_picture();
                    }
					
					
					// Every X seconds run the slow update of settings
					if (this.slow_interval_counter > this.slow_interval) {
						this.slow_interval_counter = 0;
						
						// if there are network connection issues, wait before doing the next request until this counter is zero again.
						if(this.get_init_error_counter > 0){
							this.get_init_error_counter--;
						}
						
						this.get_init();
					}
					
					
					// every X seconds run the Voco timers poll interval
					if(this.show_voco_timers){
						
						this.voco_interval_counter++;
						
						if(this.voco_interval_counter > 5){
							this.voco_interval_counter = 0;
							if(this.poll_fail_count > 0){
								if(this.debug){
									console.warn("photo-frame: delaying voco polling after a failed poll. this.poll_fail_count: ", this.poll_fail_count);
								}
								this.poll_fail_count--;
							}
							else{
								this.get_poll();
							}
						}
						
						// every second adjust the second counters of voco timers
						this.update_voco_actions();
						
					}
						
					
						
					
					
					
					// Every minute on the minute update the clock
					if (this.show_clock || this.show_date) {
						if ( new Date().getSeconds() === 0 ){
							this.update_clock();
						}
					};
					
                    //console.log(this.interval_counter);
                }, 1000);
				
				
				this.get_init();
				

				

                /*
    		document.getElementById("extension-photo-frame-back-button").addEventListener('click', () => {
    			const picture_holder = document.getElementById('extension-photo-frame-picture-holder');
    			const overview = document.getElementById('extension-photo-frame-overview');
    			this.addClass(overview,"extension-photo-frame-hidden");
    			this.removeClass(picture_holder,"extension-photo-frame-hidden");
    		});
            */


                // Get list of photos (as well as other variables)

		} // and of show function



        hide() {

            try {
                window.clearInterval(this.photo_interval);
				this.photo_interval = null;
            } catch (e) {
                //console.log("Could not clear photo rotation interval");
                //console.log(e); //logMyErrors(e); // pass exception object to error handler
            }

        }





		



		//
		//   INIT - get regular updates about settings and available photos
		//

        
		// This is called regularly, for example to make the photo frame reflect any photos that were added on another instance
		get_init(){
			
			if(this.get_init_error_counter == 0){
	            window.API.postJson(
	                `/extensions/${this.id}/api/list`, {
	                    'init': 1
	                }
	            ).then((body) => {
					this.get_init_error_counter = 0;
		            this.update_list(body);
	            }).catch((e) => {
	                if (this.debug) {
						console.log("Photo frame: get_init error: ", e);
					}
					this.get_init_error_counter = 3;
	            });
			}
		}
		
		// A general api response parser
		update_list(body){
			try{
				
				if(typeof body.debug != 'undefined'){
					this.debug = body.debug;
				}
				
                if (this.debug) {
                    console.log("photo-frame: get_init: /list response: ", body);
                }
				
				// printer
                if (typeof body.peripage_printer_available != 'undefined' && typeof body.cups_printer_available != 'undefined') {
                    this.peripage_printer_available = body.peripage_printer_available;
					this.cups_printer_available = body.cups_printer_available;
                }


				if(typeof body['interval'] != 'undefined'){
	                this.interval = parseInt(body['interval']);
	                this.fit_to_screen = body['fit_to_screen'];
	                this.show_clock = body['show_clock'];
	                this.show_date = body['show_date'];
					this.greyscale = body['greyscale'];
					this.animations = body['animations'];
				}


				// weather
                if (typeof body.show_weather != 'undefined') {
                    this.show_weather = body.show_weather;
                    //console.log('body.show_weather: ', body.show_weather);
                }
	            
				
				// Voco timers
				if(typeof body.show_voco_timers != 'undefined'){
					this.show_voco_timers = body.show_voco_timers;
				}

				// photo data
				if(typeof body['data'] != 'undefined'){
					const previous_length = this.filenames.length;
                    this.filenames = body['data'];
					if(previous_length != this.filenames.length){
	                    this.show_list(body['data']);
						if(previous_length == 0){
							this.random_picture();
						}
						if(previous_length < this.filenames.length){
							this.show_file(this.filenames[this.filenames.length-1]);
						}
					}
				}
                
				
				// Update HTML based on (potentially changed) settings
				if (document.getElementById('extension-photo-frame-content') != null && this.do_not_show_next_random_photo == false) {

		            if (typeof body.weather_addon_exists != 'undefined') {
		                if (this.show_weather) {
		                    if (body.weather_addon_exists == true) {
		                        if (this.weather_addon_exists == false) {
		                            this.weather_addon_exists = true;
		                            this.find_weather_thing();
		                        }
		                        this.update_weather();
		                    }
		                }
		            }

		            if (this.show_date) {
		                document.getElementById('extension-photo-frame-date').classList.add('show');
		            } else {
		                document.getElementById('extension-photo-frame-date').classList.remove('show');
		            }
		            if (this.show_clock) {
		                document.getElementById('extension-photo-frame-clock').classList.add('show');
		            } else {
		                document.getElementById('extension-photo-frame-clock').classList.remove('show');
		            }
	            
					if(this.greyscale){
						document.getElementById('extension-photo-frame-content').classList.add('extension-photo-frame-greyscale');
					}
					else{
						document.getElementById('extension-photo-frame-content').classList.remove('extension-photo-frame-greyscale');
					}
				
	                if (this.fit_to_screen == 'contain') {
	                    //console.log("Contain the image");
	                    document.getElementById('extension-photo-frame-picture1').style.backgroundSize = "contain";
	                    document.getElementById('extension-photo-frame-picture2').style.backgroundSize = "contain";
	                } else if (this.fit_to_screen == 'cover') {
	                    //console.log("Do not contain the image");
	                    document.getElementById('extension-photo-frame-picture1').style.backgroundSize = "cover";
	                    document.getElementById('extension-photo-frame-picture2').style.backgroundSize = "cover";
	                } else {
	                    document.getElementById('extension-photo-frame-picture1').style.backgroundSize = "cover";
	                    document.getElementById('extension-photo-frame-picture2').style.backgroundSize = "contain";
	                }
				
	            	if (this.peripage_printer_available || this.cups_printer_available) {
						document.getElementById('extension-photo-frame-content').classList.add('extension-photo-frame-printer-available');
	                }
					else{
						document.getElementById('extension-photo-frame-content').classList.remove('extension-photo-frame-printer-available');
					}
					
					
					document.getElementById('extension-photo-frame-picture1').style['animation-duration'] = (this.interval+1) + 's';
					document.getElementById('extension-photo-frame-picture2').style['animation-duration'] = (this.interval+1) + 's';
					
					if(document.getElementById('extension-photo-frame-screensaver-indicator')){
						document.getElementById('extension-photo-frame-screensaver-indicator').style['animation-duration'] = this.screensaver_delay + 's';
					}
					
                }
				
			}
            catch(e){
            	if (this.debug) {
					console.error("photo frame: error parsing update list data: ", e);
				}
            }
			
		}







		//
		//  CHANGE CURRENTLY SHOWN PHOTO
		//
		
		
		// swipe left or right on a photo to navigate between them
		check_swipe_direction() {
			//this.last_activity_time = new Date().getTime();
			if (this.touchendX < this.touchstartX - 20){
				if(this.debug){
					console.log('photo-frame: swiped left');
				}
				this.next_picture();
			}
			if (this.touchendX > this.touchstartX + 20){
				if(this.debug){
					console.log('photo-frame: swiped right');
				}
				this.previous_picture();
			}
	
		}


		previous_picture(){
			if(this.debug){
				console.log("previous_picture: before this.current_photo_number: ", this.current_photo_number);
			}
			this.current_photo_number--;
			if(this.current_photo_number < 0){
				this.current_photo_number = this.filenames.length - 1;
			}
			this.show_file( this.filenames[this.current_photo_number] );
			if(this.debug){
				console.log("photo-frame: previous_picture: after this.current_photo_number: ", this.current_photo_number);
			}
		}


		next_picture(){
			if(this.debug){
				console.log("next_picture: before this.current_photo_number: ", this.current_photo_number);
			}
			this.current_photo_number++;
			if(this.current_photo_number >= this.filenames.length){
				this.current_photo_number = 0;
			}
			this.show_file( this.filenames[this.current_photo_number] );
			if(this.debug){
				console.log("photo-frame: next_picture: after this.current_photo_number: ", this.current_photo_number);
			}
		}


        random_picture() {
            if (this.filenames.length > 0 && this.do_not_show_next_random_photo == false) {
				if(this.debug){
					console.log("photo frame: random_picture: before this.current_photo_number: ", this.current_photo_number);
				}
				this.current_photo_number = Math.floor(Math.random() * this.filenames.length);
				if(this.debug){
					console.log("photo frame: random_picture: after this.current_photo_number: ", this.current_photo_number);
				}
                var random_file = this.filenames[this.current_photo_number];
                //console.log("new picture: " + random_file);
                this.show_file(random_file);
            }
        }


        show_file(filename) {
			if(this.debug){
				console.log("photo-frame: show_file. filename: ", filename);
			}
			
			// filename for printing
			document.getElementById("extension-photo-frame-print-confirm-button").setAttribute('data-photo-name',filename);
			
            const picture_holder = document.getElementById('extension-photo-frame-picture-holder');
            const picture1 = document.getElementById('extension-photo-frame-picture1');
            const picture2 = document.getElementById('extension-photo-frame-picture2');
            //const overview = document.getElementById('extension-photo-frame-overview');
            //console.log("showing photo: " + filename);

			//picture1.style['transform-origin'] = 'center';
			
			
			

            if (this.current_picture == 1) {
                this.current_picture = 2;
				
				if(this.animations){
					picture2.classList.add('extension-photo-frame-invisible');
				}
				
                picture2.style.backgroundImage = "url(/extensions/photo-frame/photos/" + filename + ")";
                picture2.classList.add('extension-photo-frame-current-picture');
				picture1.classList.remove('extension-photo-frame-current-picture');
				//picture2.classList.add('extension-photo-frame-current-top-picture');
				//picture1.classList.remove('extension-photo-frame-current-top-picture');
				
				
                setTimeout(() => {
                    //picture1.classList.remove('extension-photo-frame-current-picture');
                }, 500);
				
                setTimeout(() => {
                    //picture2.classList.remove('extension-photo-frame-invisible')
                }, 4000);

                // Also update the list of photos.

            } else {
                // Switching from picture 2 to back to picture 1
                this.current_picture = 1;
				
				if(this.animations){
					picture1.classList.add('extension-photo-frame-invisible');
				}
				
                picture1.style.backgroundImage = "url(/extensions/photo-frame/photos/" + filename + ")";
                picture1.classList.add('extension-photo-frame-current-picture');
				picture2.classList.remove('extension-photo-frame-current-picture');
				//picture1.classList.add('extension-photo-frame-current-top-picture');
				//picture2.classList.remove('extension-photo-frame-current-top-picture');
				
                setTimeout(() => {
                    //picture2.classList.remove('extension-photo-frame-current-picture');
                }, 500);
				
                setTimeout(() => {
                    //picture1.classList.remove('extension-photo-frame-invisible')
                }, 4000);

            }




			// load image source into offscreen image, and once loaded calculate the region of interest
			if(this.animations && smartcrop){
				picture_holder.classList.add('extension-photo-frame-has-animations');
				
				let roi_image = document.createElement('img');
			
				roi_image.onload = () => {
					//console.log("image dimensions: ", roi_image.width, roi_image.height);
					smartcrop.crop(roi_image, { width: 100, height: 100 })
					.then((result) => {
						
						if(typeof result.topCrop != 'undefined'){
							result = result.topCrop;
							console.log("image width: ", roi_image.width);
							console.log("image height: ", roi_image.height);
							console.log("smartcrop result: ", result.x,result.y,result.width,result.height);
							console.log("window.innerWidth: ", window.innerWidth);
							//console.log("window.clientWidth: ", window.clientWidth);
							
							//window.innerWidth / 2
							//roi_image.width
							
							//.clientWidth/Height
							let center_x = roi_image.width / 2;
							let center_y = roi_image.height / 2;
							console.log("center_x: ", center_x);
							
							
							let transform_x = result.x + (result.width / 2);
							let transform_y = result.y + (result.height / 2);
							const transform_x_orig = transform_x;
							
							console.log("transform_x: ", transform_x);
							
							let transform_x_percentage = (transform_x / roi_image.width) * 100;
							let transform_y_percentage = (transform_y / roi_image.height) * 100;
							console.log("transform_x_percentage: ", transform_x_percentage);
							console.log("transform_y_percentage: ", transform_y_percentage);
							
							
							if(transform_x < window.innerWidth / 2){
								//transform_x = window.innerWidth;
							}
							if(transform_x < window.innerWidth / 2){
								//transform_x = window.innerWidth;
							}
							
							
							
							if(transform_x < center_x){
								transform_x = transform_x + ((center_x-transform_x) /1.5);
							}
							else if(transform_x > center_x){
								transform_x = transform_x - ((transform_x-center_x) /1.5);
							}
							
							
							//console.log("center x: ", result.x + (result.width / 2));
						
						
							//let transform_center = Math.round(transform_x) + 'px ' + Math.round(transform_y) + 'px';
							let transform_center = Math.round(transform_x_percentage) + '% ' + Math.round(transform_y_percentage) + '%';
							console.log("transform_center: ", transform_center);
				            
							if (this.current_picture == 1) {
				                picture1.style['transform-origin'] = transform_center;
								picture1.classList.remove('extension-photo-frame-effect');
								setTimeout(() => {
									picture1.classList.add('extension-photo-frame-effect');
									picture1.classList.remove('extension-photo-frame-invisible');
								},1);
								/*
								setTimeout(() => {
									picture2.classList.remove('extension-photo-frame-effect');
								}, (this.interval/95) * 3000); // 3% of the animation the new photo is still invisible, so the old photo can remain visible a little longer
								*/
							}
							else{
								picture2.style['transform-origin'] = transform_center;
								picture2.classList.remove('extension-photo-frame-effect');
								setTimeout(() => {
									picture2.classList.add('extension-photo-frame-effect');
									picture2.classList.remove('extension-photo-frame-invisible');
									
								},1);
								/*
								setTimeout(() => {
									picture2.classList.remove('extension-photo-frame-effect');
								},2000);
								*/
							}
						}
						
					});
				}
				
				roi_image.src= "/extensions/photo-frame/photos/" + filename;
				
	            if (this.current_picture == 1) {
					//picture2.classList.add('extension-photo-frame-invisible')
	                //picture2.style['transform-origin'] = 'center';
				}
				else{
					//picture1.classList.add('extension-photo-frame-invisible')
					//picture1.style['transform-origin'] = 'center';
				}
				
			}
			else{
				picture_holder.classList.remove('extension-photo-frame-has-animations');
				picture1.classList.remove('extension-photo-frame-invisible');
				picture2.classList.remove('extension-photo-frame-invisible');
				picture1.classList.remove('extension-photo-frame-effect');
				picture2.classList.remove('extension-photo-frame-effect');
			}




            //this.interval_counter = 0;
        }



		
		
		
		
		
		




		//
		//   PRINT
		//

        print_file(filename) {
            if(this.debug){
				console.log('photo frame: in print_file.  filename: ', filename);
			}
            window.API.postJson(
                `/extensions/${this.id}/api/print`, {
                    'action': 'print',
                    'filename': filename
                }
            ).then((body) => {
                if(this.debug){
					console.log('file sent to printer. response: ', body);
				}
            }).catch((e) => {
                console.log("Photo frame: error in print response: ", e);
                alert("Could not print file - connection error?");
            });
        }




		//
		//  CLOCK OVERLAY
		//


        update_clock() {
            if (this.show_clock || this.show_date) {
                window.API.postJson(
                    `/extensions/photo-frame/api/get_time`,
                ).then((body) => {
                    if (typeof body.hours != 'undefined') {

                        var hour_padding = "";
                        var minute_padding = "";

                        if (this.show_clock) {
                            document.getElementById('extension-photo-frame-clock').innerText = body.hours + ":" + minute_padding + body.minutes;
                        }

                        if (this.show_date) {

                            // Day name
                            const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                            
                            var nice_day_name = body.day_name
                            for (let i = 0; i < days.length; i++) {
                                if(days[i].startsWith(body.day_name) ){
                                    nice_day_name = days[i];
                                }
                            }
                            document.getElementById('extension-photo-frame-date-day').innerText = nice_day_name; //days[date.getDay()];

                            // Day of month
                            document.getElementById('extension-photo-frame-date-date').innerText = body.date; //date.getDate();

                            // Month name
                            const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                            document.getElementById('extension-photo-frame-date-month').innerText = body.month; //months[date.getMonth()];
                        }
                    }
                }).catch((e) => {
                    console.error("Photo frame: error getting date/time: ", e);   
                });
            }
        }




		//
		//  WEATHER OVERLAY
		//

        find_weather_thing() {
            //console.log("in get_weather_thing");
            if (this.show_weather) {
                if (this.weather_thing_url == null) {

                    API.getThings().then((things) => {
                        //console.log('things:', things);
                        this.all_things = things;

                        // First try to find the Candle weather addon
                        for (let key in things) {
                            if (things[key].hasOwnProperty('href')) {
                                if (things[key]['href'].indexOf('/things/candle-weather-today') != -1) {
                                    //console.log("found candle weather thing. href: ", things[key]['href'], things[key]);
                                    this.weather_thing_url = things[key]['href'];
                                    //console.log('description: ', things[key]['properties']['description']['value'] );
                                    //console.log('temperature: ', things[key]['properties']['temperature']['value'] );
                                    this.update_weather();
                                    //return;
                                    break;
                                }
                            }
                        }

                        if (this.weather_thing_url == null) {
                            // If the Candle weather addon doesn't exist, try the other one.
                            for (let key in things) {

                                if (things[key].hasOwnProperty('href')) {
                                    if (things[key]['href'].indexOf('/things/weather-') != -1) {
                                        //console.log("found weather thing. href: ", things[key]['href']);
                                        this.weather_thing_url = things[key]['href'];
                                        //console.log('description: ', things[key]['properties']['description']['value'] );
                                        //console.log('temperature: ', things[key]['properties']['temperature']['value'] );
                                        this.update_weather();
                                        break;
                                    }
                                }
								
                            }
                        }

                    });

                } else {
                    //console.log("weather thing url was already found: ", this.weather_thing_url);
                }

            } else {
                //console.log('show weather is disabled, not finding thing');
            }

        }


        update_weather() {
            //console.log("in update_weather");
            if (this.weather_thing_url != null) {
				
				if(this.weather_fail_count < 1){
					
                	API.getJson(this.weather_thing_url + '/properties/temperature')
                    .then((prop) => {
                        if(this.debug){
							console.log("weather temperature property: ", prop);
						}
                        let temperature_el = document.getElementById('extension-photo-frame-weather-temperature');
                        if (temperature_el != null) {
                            document.getElementById('extension-photo-frame-weather-temperature').innerText = prop;
                            //document.getElementById('extension-photo-frame-weather-description').innerText = things[key]['properties']['description']['value'];
                        } else {
                            //console.log('weather temperature element did not exist yet');
                        }
                    }).catch((e) => {
                        if(this.debug){
							console.log("Photo frame: update_weather: error getting temperature property: ", e);
						}
						this.weather_fail_count = 10;
                    });


                	//API.getJson(this.weather_thing_url + '/properties/description')
					API.getJson(this.weather_thing_url + '/properties/current_description')
                    .then((prop) => {
                        if(this.debug){
							console.log("weather current_description property: ", prop);
						}
                        let description_el = document.getElementById('extension-photo-frame-weather-description');
                        if (description_el != null) {
                            document.getElementById('extension-photo-frame-weather-description').innerText = prop;
                        } else {
                            //console.log('weather description element did not exist yet');
                        }
                    }).catch((e) => {
                        if(this.debug){
							console.log("Photo frame: update_weather: error getting current_description property: ", e);
						}
						this.weather_fail_count = 10;
                    });
				}
				if(this.weather_fail_count > 0){
					if(this.debug){
						console.warn("there was an error polling the Candle weather thing. Delaying a while before trying again. this.weather_fail_count: ", this.weather_fail_count);
					}
					this.weather_fail_count--;
				}
				
                
            } else {
                if(this.debug){
					console.warn('Warning, in update_weather, but no thing url');
				}
            }
        }






		//
		//  VOCO TIMERS OVERLAY
		//


		// Get list of Voco timers from api every 5 seconds
        get_poll() {
			if (this.debug) {
				//console.log("photo-frame: in get_poll, polling for voco actions");
			}
            
			window.API.postJson(
                `/extensions/photo-frame/api/poll`,
            ).then((body) => {
                if (this.debug) {
					//console.log("photo-frame: voco actions: ", body);
				}
				this.poll_fail_count = 0;
				
				if(typeof body.action_times != 'undefined'){
					const previous_action_times_length = this.action_times.length;
					this.action_times = body.action_times;
					if(this.debug && this.action_times.length != previous_action_times_length){
						console.log("photo frame: get_poll: new Voco action_times: ", this.action_times);
					}
				}
            }).catch((e) => {
                if (this.debug) {
					console.error("Photo frame: error doing periodic poll for voco actions: ", e);
				}
				this.poll_fail_count = 12; // delays 12 * 5 seconds
            });
        }
		
		
		// Update the HTML of Voco timers
		update_voco_actions(){
			
			let voco_overlay_el = document.getElementById('extension-photo-frame-voco-container');
			
			const d = new Date();
			let time = Math.floor(d.getTime() / 1000);
			
			for (let i = 0; i < this.action_times.length; i++) {
				const action = this.action_times[i];
				//console.log("voco action: ", action);
				
				try{
					if(action.slots.timer_type){
						const delta = action.moment - time;
						console.log("delta: ", delta);
						if(delta >= 0 && delta < 3600){
							const item_id = "extension-photo-frame-voco-" + action.intent_message.sessionId;
							console.log("item_id: ", item_id);
							let action_el = document.getElementById(item_id);
							console.log("action_el existed");
							if(action_el == null){
								action_el = document.createElement('div');
								action_el.classList.add('extension-photo-frame-voco-item');
								action_el.classList.add('extension-photo-frame-voco-item-' + action.slots.timer_type);
								action_el.id = item_id;
								action_el.innerHTML =  '<img src="/extensions/photo-frame/images/' + action.slots.timer_type + '.svg"/><div class="extension-photo-frame-voco-item-time"><span class="extension-photo-frame-voco-item-minutes"></span><span class="extension-photo-frame-voco-item-seconds"></span></div>';
								action_el.innerHTML += '<div class="extension-photo-frame-voco-item-info"><h4 class="extension-photo-frame-voco-item-title">' + action.slots.sentence + '</h4></div>';
								voco_overlay_el.appendChild(action_el);
							}
							let minutes = Math.floor(delta / 60);
							if(minutes == 0){minutes = ''}
							else if(minutes < 10){minutes = '0' + minutes}
					
							let seconds = Math.floor(delta % 60);
					
							if(minutes == '' && seconds == 0){seconds = ''}
							else if(seconds < 10){seconds = '0' + seconds}
					
							action_el.querySelector('.extension-photo-frame-voco-item-minutes').innerText = minutes;
							action_el.querySelector('.extension-photo-frame-voco-item-seconds').innerText = seconds; 
						}
					}
					else{
						if(this.debug){
							console.log("timer had no timer type (likely a delayed switching of a device): ", action);
						}
					}
				}
				catch(e){
					console.error("photo frame: error parsing Voco timer: ", e);
				}
				
			}
			
		}








        //
        //  PHOTO THUMBNAILS VIEW
        //


        show_list(file_list=null) {
			if(file_list == null){
				if(this.filenames != null){
					file_list = this.filenames;
				}
				else{
					console.error("photo-frame: show_list: no photo file list to show");
					return;
				}
			}
            //console.log("Updating photo list")
            //const pre = document.getElementById('extension-photo-frame-response-data');
            const photo_list = document.getElementById('extension-photo-frame-photos-list');
            const picture_holder = document.getElementById('extension-photo-frame-picture-holder');
            const overview = document.getElementById('extension-photo-frame-overview');
            const picture1 = document.getElementById('extension-photo-frame-picture1');
            const picture2 = document.getElementById('extension-photo-frame-picture2');

            file_list.sort();

            this.filenames = file_list;
            //this.filenames = file_list;

            photo_list.innerHTML = "";

			var photo_counter = 0;
            for (var key in file_list) {
				
				const photo_count = photo_counter;
                var node = document.createElement("LI"); // Create a <li> node
                node.setAttribute("class", "extension-photo-frame-list-item");
                node.setAttribute("data-filename", file_list[key]);

                var img_container_node = document.createElement("div"); // Create a <li> node
                img_container_node.setAttribute("class", "extension-photo-frame-list-thumbnail-container");

                var imgnode = document.createElement("IMG"); // Create a text node
                imgnode.setAttribute("class", "extension-photo-frame-list-thumbnail");
                imgnode.setAttribute("data-filename", file_list[key]);
                imgnode.src = "/extensions/photo-frame/photos/" + file_list[key];
                imgnode.onclick = (event) => {
					this.current_photo_number = photo_count;
					//console.log("setting this.current_photo_number to: ", this.current_photo_number);
                    this.show_file(event.target.getAttribute("data-filename")); //file_list[key]
                    this.addClass(overview, "extension-photo-frame-hidden");
                    this.removeClass(picture_holder, "extension-photo-frame-hidden");
					//console.log("clicked on image #: ", photo_count);
					
                };
                //console.log(imgnode);
                img_container_node.appendChild(imgnode);
                node.appendChild(img_container_node);

                /*
    			var textnode = document.createElement("span"); 
    			textnode.setAttribute("class","extension-photo-frame-thumbnail-name");
    			textnode.setAttribute("data-filename", file_list[key]);
    			//console.log(textnode);
                var file_name_human_readable = file_list[key].substring(0, file_list[key].lastIndexOf('.')) || file_list[key]
    			textnode.innerHTML = file_name_human_readable.replace(/\_/g , " ");         // Create a text node
    			node.appendChild(textnode); 
                */

                // Add delete button
                var delete_button = document.createElement("div");
                delete_button.setAttribute("class", "extension-photo-frame-thumbnail-delete-button");
                delete_button.setAttribute("data-filename", file_list[key]);

                //delete_button.onclick = () => { 
                delete_button.addEventListener('click', (event) => {
                    //this.delete_file( file_list[key] );
                    //console.log(this.getAttribute("data-filename"));
                    if (confirm("Are you sure?")) {
                        this.delete_file(event.target.getAttribute("data-filename"));
                    }

                });
                node.appendChild(delete_button);


                // Add print button. This is now handled on the picture itself.
				/*
                var print_button = document.createElement("div");
                print_button.setAttribute("class", "extension-photo-frame-thumbnail-print-button");
                print_button.setAttribute("data-filename", file_list[key]);
                print_button.setAttribute("title", "Print");

                //print_button.onclick = () => { 
                print_button.addEventListener('click', (event) => {
                    //this.print_file( file_list[key] );
                    //console.log(this.getAttribute("data-filename"));
                    if (confirm("Are you sure you want to print this picture?")) {
                        this.print_file(event.target.getAttribute("data-filename"));
                    }

                });
                node.appendChild(print_button);
				*/
				
                photo_list.appendChild(node);
				
				if(photo_counter == this.current_photo_number){
					const target_node = node;
					node.classList.add("extension-photo-frame-thumbnail-highlighter");
					setTimeout(() => {
						target_node.scrollIntoView({block: "center", inline: "center"});
					},100)
					
				}
				
				photo_counter++;
				
            }
        }



        delete_file(filename) {
            if(this.debug){
				console.log("Deleting file:" + filename);
			}
	        window.API.postJson(
                `/extensions/${this.id}/api/delete`, {
                    'action': 'delete',
                    'filename': filename
                }

            ).then((body) => {
                if(this.debug){
					console.log("photo frame: delete file response: ", body);
				}
                this.show_list(body['data']);

            }).catch((e) => {
                console.error("Photo frame: error in delete response: ", e);
                alert("Could not delete file - connection error?");
            });

        }






		//
		//  FILE UPLOAD
		//

        upload_files(files) {
            if (files && files[0]) {

				for (let i = 0; i < files.length; i++) {
					setTimeout(() => {
						
		                var filename = files[i]['name'].replace(/[^a-zA-Z0-9\.]/gi, '_').toLowerCase(); //.replace(/\s/g , "_");
		                var filetype = files[i].type;
		                //console.log("filename and type: ", filename, filetype);

						if(this.debug){
							console.log("photo-frame: resizing: photo. Filename,filetype: ", filename, filetype);
						}

		                //console.log("this1: ", this);
		                var reader = new FileReader();

		                reader.addEventListener("load", (e) => {
						
		                    var image = new Image();
						
		                    image.src = reader.result;

		                    var this2 = this;

		                    image.onload = function() {
								if(this.debug){
									console.log("photo-frame: offscreen image loaded");
								}
		                        var maxWidth = 1920,
		                            maxHeight = 1920,
		                            imageWidth = image.width,
		                            imageHeight = image.height;

		                        if (imageWidth > imageHeight) {
		                            if (imageWidth > maxWidth) {
		                                imageHeight *= maxWidth / imageWidth;
		                                imageWidth = maxWidth;
		                            }
		                        } else {
		                            if (imageHeight > maxHeight) {
		                                imageWidth *= maxHeight / imageHeight;
		                                imageHeight = maxHeight;
		                            }
		                        }

		                        var canvas = document.createElement('canvas');
		                        canvas.width = imageWidth;
		                        canvas.height = imageHeight;

		                        var ctx = canvas.getContext("2d");
		                        ctx.drawImage(this, 0, 0, imageWidth, imageHeight);

		                        // The resized file ready for upload
		                        var finalFile = canvas.toDataURL(filetype);

								if(this.debug){
									console.log("sending resized photo to backend: ", filename);
								}
		                        window.API.postJson(
		                            `/extensions/photo-frame/api/save`, {
		                                'action': 'upload',
		                                'filename': filename,
		                                'filedata': finalFile,
		                                'parts_total': 1,
		                                'parts_current': 1
		                            } //e.target.result

		                        ).then((body) => {
		                            if(this.debug){
										console.log("saved photo. body:", body);
									}
									//if(i == files.length - 1){
									
									//}
		                            this2.show_list(body['data']);
								

		                        }).catch((err) => {
		                            console.log("Error uploading image: ", err);
		                            //alert("Error, could not upload the image. Perhaps it's too big.");     
		                        });

		                    };

		                });

	                	reader.readAsDataURL( files[i] );
						
					},2000);
	                
				}
            }
        }

        
    	createDropzoneMethods() {
			console.log("photo-frame: in createDropzoneMethods");
    	    let dropzone = document.getElementById("extension-photo-frame-dropzone");

    		//var this = this;
    	    dropzone.ondragover = () => {
    	        dropzone.className = "extension-photo-frame-dragover";
    	        return false;
    	    }

    	    dropzone.ondragleave = () => {
    	        dropzone.className = "";
    	        return false;
    	    }

    	    dropzone.ondrop = (event) => {
    	        // Stop browser from simply opening that was just dropped
    	        event.preventDefault();  
    	        // Restore original dropzone appearance
    	        dropzone.className = "";
    			var files = event.dataTransfer.files;
    			this.upload_files(files);
    	    }    
    	}
        
		
		
		
		
		
        //
        //  SCREENSAVER LISTENERS
        //

		// If another view was active, the screensaver will try to jump back to that view if mouse activity is detected


        start_screensaver_listeners() {

            //this.screensaver_interval = setInterval(myCallback, 500);
            this.screensaver_interval = setInterval(() => {

                const current_time = new Date().getTime();
                const delta = current_time - this.last_activity_time;
                //console.log('delta: ', delta);
                if (delta > this.screensaver_delay * 1000) {
                    if (this.showing_screensaver == false) {
						if(this.debug){
							console.log("Photo frame: STARTING SCREENSAVER");
						}
                        this.screensaver_ignore_click = true;
                        window.setTimeout(() => {
                            this.screensaver_ignore_click = false; // ignore the click on the Photo Frame menu button, as that would immediately cancel the screensaver..
                        },10);
                        //console.log('should start screensaver');
                        this.screensaver_path = window.location.pathname;
                        //console.log("remembered path: ", this.screensaver_path);
                        this.showing_screensaver = true;
                        document.body.classList.add('screensaver');
                        if (this.screensaver_path != '/extensions/photo-frame') {
                            const photo_frame_menu_button = document.getElementById("extension-photo-frame-menu-item");
                            if (photo_frame_menu_button != null) {
                                photo_frame_menu_button.click();
                            }
                        }
                    }
                } else {
                    if (this.showing_screensaver == true) {

                        var short_path = "photo-frame";
						// this.screensaver_path contains the location right before the screensaver started.
                        if (this.screensaver_path.startsWith('/extensions')) {
                            var short_path = this.screensaver_path.split('/')[2];
                        } else {
                            var short_path = this.screensaver_path.split('/')[1];
                        }


						if(short_path != "photo-frame"){
							if(this.debug){
								console.log("photo-frame: screensaver: short_path to return to: ", short_path);
							}

	                        var spotted_in_menu = false;
	                        const addon_name_css = short_path.replace(/_/g, "-");
	                        //console.log(addon_name_css);
	                        const menu_elements = document.querySelectorAll('#main-menu li a');
	                        var id_to_click_on = "extension-photo-frame-menu-item";
	                        menu_elements.forEach(element => {
	                            var link_id = element.getAttribute('id');
	                            var short_link_id = link_id.replace("-menu-item", "");
	                            short_link_id = short_link_id.replace("extension-", "");
	                            //short_link_id = link_id.replace("extension-", "");
	                            //if(short_link_id.endsWith(addon_name_css)){
	                            //console.log(" --> ", short_link_id);
	                            if (short_link_id == addon_name_css) {
	                                spotted_in_menu = true;
	                                id_to_click_on = link_id;
	                            }
	                        });

	                        if (spotted_in_menu == false) {
	                            if (this.debug) {
	                                console.log('screensaver could not restore the page. addon_name_css: ', addon_name_css);
	                            }
	                            //window.location.pathname = this.screensaver_path;
	                        } else {
	                            const menu_link = document.getElementById(id_to_click_on);
	                            menu_link.click(); //dispatchEvent('click');
	                        }
						}
						
						
                        document.getElementById('menu-button').classList.remove('hidden'); // the menu button is no longer hidden?
                        document.body.classList.remove('screensaver');

                    }
                    this.showing_screensaver = false;
                }

                if (delta < 1500) {
                    if (document.body.classList.contains('developer')) {
                        const indicator = document.getElementById("extension-photo-frame-screensaver-indicator");
                        if (indicator != null) {
                            indicator.parentNode.removeChild(indicator);
                        }
                        let indicator_element = document.createElement("div");
                        indicator_element.setAttribute('id', 'extension-photo-frame-screensaver-indicator');
                        document.body.append(indicator_element);
                    }
                }

            }, 1000);



            //console.log('starting activity timeout check for screensaver. Delay seconds: ', this.screensaver_delay);

            // Mouse
            window.addEventListener('mousemove', () => {
                if (!this.screensaver_ignore_click) {
					this.last_activity_time = new Date().getTime();
				}
            }, {
                passive: true
            });
            window.addEventListener('mousedown', () => {
				if (!this.screensaver_ignore_click) {
                	this.last_activity_time = new Date().getTime();
				}
            }, {
                passive: true
            });
            window.addEventListener('click', () => {
                if (this.screensaver_ignore_click) {
                    if(this.debug){
						console.log('ignoring click');
                    }
                } else {
                    this.last_activity_time = new Date().getTime();
                }
            }, {
                passive: true
            });

            // Touch
            window.addEventListener('touchstart', () => {
                if (!this.screensaver_ignore_click) {
					this.last_activity_time = new Date().getTime();
				}
            }, {
                passive: true
            });
            window.addEventListener('touchmove', () => {
                if (!this.screensaver_ignore_click) {
					this.last_activity_time = new Date().getTime();
				}
            }, {
                passive: true
            });

            // Scroll
            window.addEventListener('scroll', () => {
                if (!this.screensaver_ignore_click) {
					this.last_activity_time = new Date().getTime();
				}
            }, true);

        }
		
		
		
		
		
        // HELPER METHODS
		// TODO: Are these still used?

        hasClass(ele, cls) {
            return !!ele.className.match(new RegExp('(\\s|^)' + cls + '(\\s|$)'));
        }

        addClass(ele, cls) {
            if (!this.hasClass(ele, cls)) ele.className += " " + cls;
        }

        removeClass(ele, cls) {
            if (this.hasClass(ele, cls)) {
                var reg = new RegExp('(\\s|^)' + cls + '(\\s|$)');
                ele.className = ele.className.replace(reg, ' ');
            }
        }


    }

    new PhotoFrame();

})();