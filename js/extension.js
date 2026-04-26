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
			
			//console.log("photo frame: window.API: ", window.API);
			
            this.debug = false;
			this.developer = false;
			
            //console.log(window.API);
            this.content = '';
			this.early_init_retried = false;
			
			this.busy_getting_list = false;
			this.busy_polling = false;
			this.poll_fail_count = 0; // set to a higher number if the voco actions update failed
			
			this.subscribed_to_thing = false;
			
			this.websockets = {};
			this.websocket_before_unload_added = false;
			
			this.night_mode = false;
			this.added_a_photo = false;
			
			
			
			

            // Screensaver allowed
			this.screensaver_allowed_in_this_browser = false;
			this.screensaver_allowed_in_this_browser_once = false;
			const screensaver_allowed_check = localStorage.getItem('candle_screensaver_enabled');
			if(typeof screensaver_allowed_check == 'string' && screensaver_allowed_check == 'true'){
				this.screensaver_allowed_in_this_browser = true;
			}
			
		
			// password hash
			// The value from local storage is only used as a backup in case of network issues.
			this.password_hash = null;
			const password_hash_check = localStorage.getItem('extension-photo-frame-password-hash');
			if(typeof password_hash_check == 'string'){
				this.password_hash = password_hash_check;
			}
			
			// password length
			// The value from local storage is only used as a backup in case of network issues.
			this.password_length = 8;
			const password_length_check = localStorage.getItem('extension-photo-frame-password-length');
			if(typeof password_length_check == 'string'){
				this.password_length = parseInt(password_length_check);
				//console.log("found password length in local storage: ", this.password_length);
			}
			
			// password enabled
			// The value from local storage is only used as a backup in case of network issues.
			this.password_enabled = false;
			const password_enabled_check = localStorage.getItem('extension-photo-frame-password-enabled');
			if(typeof password_enabled_check == 'boolean'){
				this.password_enabled = password_enabled_check;
				//console.log("found password enabled state in local storage: ", this.password_enabled);
			}
			
			// Locked mode
			// Only restored if the password hash was also restored
			this.locked = false;
			const locked_check = localStorage.getItem('extension-photo-frame-locked');
			if(this.password_hash && typeof locked_check == 'string' && locked_check == 'true'){
				// Go to the photo frame addon
				if (window.location.pathname != "/extensions/photo-frame") {
					window.location.href = window.location.origin + '/extensions/photo-frame';
				}
				this.locked = true;
				document.body.classList.add('extension-photo-frame-locked');
			}

			// Privacy mode
			this.privacy_mode_enabled = false;
			this.privacy_mode_end_time = 0;
			const check_privacy_mode_end_time = localStorage.getItem('extension-photo-frame-privacy-mode-end-time');
			if(typeof check_privacy_mode_end_time == 'number'){
				this.privacy_mode_end_time = check_privacy_mode_end_time;
			}
			this.ensure_privacy_mode();
			
			this.privacy_mode_only_in_this_browser = false;
			const privacy_mode_only_in_this_browser_check = localStorage.getItem('extension-photo-frame-privacy-mode-only-in-this-browser');
			if(typeof privacy_mode_only_in_this_browser_check == 'boolean'){
				this.privacy_mode_only_in_this_browser = privacy_mode_only_in_this_browser_check;
			}
			
			
			
			this.current_photo_number = 0;
			window.last_activity_time = new Date().getTime()
            //this.screensaver_delay = 120;
            this.showing_screensaver = false;
            this.previous_last_activity_time = 0;
            this.screensaver_path = '/extensions/photo-frame';
            this.screensaver_ignore_click = false;
			this.screensaver_listeners_added = false;
			this.screensaver_interval_busy = false;

			
			this.page_visible = true;
			document.addEventListener("visibilitychange", () => {
			  if (document.hidden) {
				  if(this.debug){
					  console.log("photo frame debug: page became hidden");
				  }
				  this.page_visible = false;
			  } else {
				  if(this.debug){
					  console.log("photo frame debug: page became visible");
				  }
				  this.page_visible = true;
			  }
			});
			
			this.show_clock = false;
			this.show_date = false;
			

            // Printer
			this.printing_allowed = false;
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
			this.show_list_called = false;

			this.hide_selected_photo_indicator_time = 0;
			//this.photo_frame_key_listener_added = false;

			this.slow_interval_counter = 0;
			this.slow_interval = 60;


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
			
			
			// Privacy mode
			this.safe_photos = [];
			this.sentences = ["What is a rave?", "Daddy is Santa Claus?", "Where are their clothes?", "What are they doing to each other?"];
			
			
            
        	fetch(`/extensions/${this.id}/views/content.html`)
            .then((res) => res.text())
            .then((text) => {
                this.content = text;
				this.early_init();
            })
            .catch((err) => console.error('photo frame: failed to fetch content:', err));

			

			// Listen for keyboard mouse arrow presses
			this.photo_frame_key_listener = (event) => {
				//console.log("in photo_frame_key_listener. Event: ", event);
				//console.log("in photo_frame_key_listener. this: ", this);
				if (window.location.pathname == "/extensions/photo-frame") {
					const arrow_key = event.key; // "ArrowRight", "ArrowLeft", "ArrowUp", or "ArrowDown"
					//console.log("photo_frame_key_listener: arrow_key: ", arrow_key);
					if(arrow_key == 'ArrowRight'){
						this.next_picture();
					}
					else if(arrow_key == 'ArrowLeft'){
						this.previous_picture();
					}
				}
			}
			
			// Listen for presses of the left and right arrow keys
			document.addEventListener('keydown', this.photo_frame_key_listener, { passive: true });
			
        }


		// called after init has loaded the content
		early_init(){
            // Check if screensaver should be active
            window.API.postJson(
                `/extensions/photo-frame/api/list`, {
                    'init': 1
                }

            ).then((body) => {
				if(body && typeof body.debug == 'boolean'){
					this.debug = body.debug;
				}
				else{
	                if (this.debug) {
	                    console.log("photo frame debug: aborting, early init response had undefined body or debug value?: ", body);
	                }
					if(this.early_init_retried == false){
						this.early_init_retried = true;
						setTimeout(() => {
			                if (this.debug) {
			                    console.log("photo frame debug: early init: trying again 10 seconds later");
			                }
							this.early_init();
						},10000);
					}
					return
				}
            
                if (this.debug) {
                    console.log("photo frame debug: early init response: ", body);
                }
				
				if(typeof body['data'] != 'undefined'){
                    this.filenames = body['data'];
					this.ensure_privacy_mode();
				}
				
                if(typeof body.night_mode == 'boolean'){
					this.night_mode = body.night_mode;
                	if(this.night_mode){
                		document.body.classList.add('extension-photo-frame-night-mode');
                	}
					else{
						document.body.classList.remove('extension-photo-frame-night-mode');
					}
                }
				
				
				/*
                if (typeof body.screensaver_delay == 'number') {
                    this.screensaver_delay = body.screensaver_delay;
                    
		            if (this.screensaver_delay > 1) {
		                if(this.debug){
							console.log('photo-frame debug: early init: calling start screensaver listeners');
						}
		                this.start_screensaver_listeners();
		            }
					else{
		                if(this.debug){
							console.log('photo-frame debug: early init:  screen saver is disabled');
						}
					}
					
					
				}
				*/
				
                if (window.location.pathname == "/extensions/photo-frame") {
                    this.show();
                }
				
				this.start_main_interval();
			
            }).catch((err) => {
                console.error("Photo frame: error in early init function: ", err);
				
				if(this.early_init_retried == false){
					this.early_init_retried = true;
					setTimeout(() => {
		                if (this.debug) {
		                    console.log("photo frame debug: early init caught error. trying again 10 seconds later");
		                }
						this.early_init();
					},10000);
				}
				
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
			
			this.current_picture = 1; // which of the two picture holders is on top
			this.do_not_show_next_random_photo = false;
			
			if(document.body.classList.contains('developer')){
				this.developer = true;
			}
			else{
				this.developer = false;
			}


			/*
			this.list = (event) => {
						console.log("photo frame: key pressed");
						this.photo_frame_key_listener(event);
					}
			*/

			let content_el = document.getElementById('extension-photo-frame-content');
			if(content_el){
				
				/*
				if(this.photo_frame_key_listener_added == false){
					//this.photo_frame_key_listener_added = true;
					
					try{
						//document.removeEventListener("keydown", this.list);
						
						document.removeEventListener("keydown", this.photo_frame_key_listener);
						console.log("past event listener removal");
					}
					catch(e){
						console.log("photo frame: show: no keylistener to remove");
					}
					document.addEventListener('keydown', this.photo_frame_key_listener, { passive: true });
					//document.addEventListener('keydown', this.list);
				}
				
				*/
				
				
				
				//document.addEventListener('keydown', this.photo_frame_key_listener); //.bind(this);
				//content_el.removeEventListener("keydown", this.photo_frame_key_listener);
				//content_el.addEventListener('keydown', this.photo_frame_key_listener);
			}
			else{
				console.error("photo frame: no content element?");
				return;
			}

			/*
			if(this.privacy_mode_end_time > Date.now()){
				if(this.debug){
					console.log("photo frame debug: show: jumping directly into privacy mode");
				}
				//this.screensaver_allowed_in_this_browser = true;
				//window.last_activity_time = 1;
				//this.do_screensaver_interval();
				this.start_privacy_mode();
			}
			*/

            const thing_list = document.getElementById('extension-photo-frame-thing-list');

			const file_selector_el = this.view.querySelector('#extension-photo-frame-photos-file-selector');
            if (this.kiosk) {
                //console.log("detected kiosk");
                file_selector_el.style.display = 'none';
                file_selector_el.outerHTML = "";
                //document.getElementById('extension-photo-frame-dropzone').outerHTML = "";

            } else {
                //console.log("Attaching file listeners");
                file_selector_el.addEventListener('change', () => {
                    var filesSelected = file_selector_el.files;
                    this.upload_files(filesSelected);
                });

                this.createDropzoneMethods(); //  disabled, as files could be too big. For now users can just upload an image one at a time.
            }

            
            const picture_holder_el = this.view.querySelector('#extension-photo-frame-picture-holder');
            const overview_el = this.view.querySelector('#extension-photo-frame-overview');
			

            // EVENT LISTENERS


			picture_holder_el.addEventListener('click', () => {
				if(this.debug){
					console.log("photo frame debug: clicked on picture holder");
				}
				document.body.classList.remove('screensaver');
			})

			// manage photos button
            this.view.querySelector('#extension-photo-frame-more-button-container').addEventListener('click', () => {
                event.stopImmediatePropagation();
                
				//this.interval_counter = 0;
                //this.show_list();
				
				picture_holder_el.classList.add('extension-photo-frame-hidden');
				overview_el.classList.remove('extension-photo-frame-hidden')
				this.view.querySelector('#extension-photo-frame-upload-progress-container').classList.add('extension-photo-frame-hidden');
				
				
				this.view.querySelector('#extension-photo-frame-privacy-mode-speech-bubble-text').textContent = this.sentences[Math.floor(Math.random() * this.sentences.length)];
				
				let photo_frame_content_el = this.view.querySelector('#extension-photo-frame-content');
				if( window.innerHeight == screen.height || window.innerWidth == screen.width || photo_frame_content_el.fullscreenElement) {
					if(this.debug){
						console.log("photo frame debug: exiting fullscreen");
					}
					if (document.exitFullscreen) {
					    document.exitFullscreen();
					  } else if (document.webkitExitFullscreen) {
					    document.webkitExitFullscreen();
					  } else if (document.msExitFullscreen) {
					    document.msExitFullscreen();
					  }
				}
            });


			// next photo button
            this.view.querySelector('#extension-photo-frame-next-photo-button-container').addEventListener('click', () => {
				if(this.debug){
					console.log("photo frame debug: next photo button clicked");
				}
                event.stopImmediatePropagation();
				event.preventDefault();
				this.interval_counter = 0;
				window.last_activity_time = new Date().getTime();
				this.next_picture();
            });
			
			
			// Night mode button
			const night_mode_button_el = this.view.querySelector('#extension-photo-frame-night-mode-button');
			if(night_mode_button_el){
				night_mode_button_el.addEventListener('click', () => {
					if(this.debug){
						console.log("photo frame debug: night mode button clicked");
					}
	                event.stopImmediatePropagation();
					event.preventDefault();
					window.last_activity_time = 1;
					this.night_mode = true;
					document.body.classList.add('extension-photo-frame-night-mode');
		            window.API.postJson(
		                `/extensions/${this.id}/api/ajax`, {
		                    'action': 'set_night_mode',
							'state':true
		                }
		            ).then((body) => {
			            this.parse_body(body);
		            }).catch((err) => {
		                if (this.debug) {
							console.log("Photo frame: caught error calling set_night_mode: ", err);
						}
		            });
				
	            });
			}
			else{
				console.error("photo frame: night mode button is missing?");
			}
			
			// Disable night mode
			const day_mode_button_el = this.view.querySelector('#extension-photo-frame-day-mode-button');
			if(day_mode_button_el){
				day_mode_button_el.addEventListener('click', () => {
					if(this.debug){
						console.log("photo frame debug: day mode button clicked");
					}
	                event.stopImmediatePropagation();
					event.preventDefault();
					window.last_activity_time = 1;
					this.night_mode = false;
					document.body.classList.remove('extension-photo-frame-day-mode');
		            window.API.postJson(
		                `/extensions/${this.id}/api/ajax`, {
		                    'action': 'set_night_mode',
							'state':false
		                }
		            ).then((body) => {
			            this.parse_body(body);
		            }).catch((err) => {
		                if (this.debug) {
							console.log("Photo frame: caught error calling API to disable night mode: ", err);
						}
		            });
				
	            });
			}
			else{
				console.error("photo frame: day mode button is missing?");
			}
			
			
			
			// start screensaver button
            this.view.querySelector('#extension-photo-frame-start-screensaver-button').addEventListener('click', (event) => {
                event.stopImmediatePropagation();
				event.preventDefault();
				if(document.body.classList.contains('developer')){
					//this.developer = true;
				}
				else{
					this.developer = false;
				}
				
				if(this.debug){
					console.log("photo frame debug: start screensaver button clicked.  this.developer: ", this.developer);
					console.log("photo frame debug:  this.screensaver_allowed_in_this_browser: ", this.screensaver_allowed_in_this_browser);
					console.log("photo frame debug:  this.screensaver_allowed_in_this_browser_once: ", this.screensaver_allowed_in_this_browser_once);
				}
				
				// Enables screensaver, but not permanently
				this.screensaver_allowed_in_this_browser_once = true
				/*
                this.screensaver_ignore_click = true; // ironically, the click the start the screensaver immediately disables it..
                window.setTimeout(() => {
                    this.screensaver_ignore_click = false;
                },1000);
				*/
				
				document.body.classList.add('screensaver');
				
				let selected_screensaver_check = localStorage.getItem('candle_selected_screensaver');
				if(typeof selected_screensaver_check == 'string' && selected_screensaver_check == '/extensions/photo-frame'){
					setTimeout(() => {
						window.last_activity_time = 1;
					},1000);
					window.last_activity_time = 1;
				}
				else{
					// TODO: avoid the screensaver instead?
				}
				
				
				// Go fullscreen
				if(this.kiosk == false && this.developer == false){
					let photo_frame_content_el = document.getElementById('extension-photo-frame-content');
					/*
					if (photo_frame_content_el.fullscreenElement) {
					    photo_frame_content_el
					      .exitFullscreen()
					      .then(() => console.log("Photo frame: Exited from Full screen mode"))
					      .catch((err) => console.error("Photo frame: error exiting fullscreen mode: ", err));
					} else {
					    photo_frame_content_el.requestFullscreen();
					}
					*/
					if(this.debug){
						console.log("photo frame debug: window.innerHeight,screen.height", window.innerHeight, screen.height);
						console.log("photo frame debug: photo_frame_content_el.fullscreenElement: ", photo_frame_content_el.fullscreenElement);
					}
					if( window.innerHeight == screen.height || window.innerWidth == screen.width || photo_frame_content_el.fullscreenElement) {
						//console.log("photo frame: exiting fullscreen");
						if (document.exitFullscreen) {
						    document.exitFullscreen();
						  } else if (document.webkitExitFullscreen) {
						    document.webkitExitFullscreen();
						  } else if (document.msExitFullscreen) {
						    document.msExitFullscreen();
						  }
					}
					else{
						//console.log("photo frame: requesting fullscreen");
						if (photo_frame_content_el.requestFullscreen) {
						    photo_frame_content_el.requestFullscreen();
						} else if (photo_frame_content_el.webkitRequestFullscreen) { /* Safari */
						    photo_frame_content_el.webkitRequestFullscreen();
						} else if (photo_frame_content_el.msRequestFullscreen) { /* IE11 */
						    photo_frame_content_el.msRequestFullscreen();
						}
					}
					
				}
				
            });
			
			


			// Cups printer buttons
            this.view.querySelector('#extension-photo-frame-print-button').addEventListener('click', () => {
				const proto_to_print = this.view.querySelector('#extension-photo-frame-print-confirm-button').getAttribute('data-photo-name');
				this.do_not_show_next_random_photo = true;
				//console.log("cups print photo button clicked");
                event.stopImmediatePropagation();
				event.preventDefault();
				this.view.querySelector('#extension-photo-frame-print-button-container').classList.add('extension-photo-frame-print-button-show-confirmation');
				
                this.view.querySelector('#extension-photo-frame-picture1').style.backgroundSize = "contain";
                this.view.querySelector('#extension-photo-frame-picture2').style.backgroundSize = "contain";
				
				/*
				setTimeout(() => {
					if(document.getElementById("extension-photo-frame-print-confirm-button").getAttribute('data-photo-name') == proto_to_print){
						
					}
					document.getelementById("extension-photo-frame-print-button-container").classList.remove('extension-photo-frame-print-button-show-confirmation');
					
					this.do_not_show_next_random_photo = false;
				},8000);
				*/
            });
			
			
			this.view.querySelector('#extension-photo-frame-print-confirm-button').addEventListener('click', () => {
				//console.log("cups really print photo button clicked");
                event.stopImmediatePropagation();
				event.preventDefault();
				const confirm_button_el = this.view.querySelector('#extension-photo-frame-print-confirm-button');
				confirm_button_el.style.display = 'none';
				setTimeout(() => {
					confirm_button_el.style.display = 'inline-block';
				},3000);
				const photo_name = confirm_button_el.getAttribute('data-photo-name');
				if(this.debug){
					console.log("proto frame: print button: photo name: ", photo_name);
				}
				if(photo_name.endsWith('.gif')){
					this.flash_message("animations cannot be printed");
				}
				else{
					this.print_file( photo_name );
				}
				this.do_not_show_next_random_photo = false;
				//document.getElementById("extension-photo-frame-print-button-container").classList.remove('extension-photo-frame-print-button-show-confirmation');
				
			});
			
			document.getElementById("extension-photo-frame-print-cancel-button").addEventListener('click', () => {
				if(this.debug){
					console.log("cups cancel print photo button clicked");
				}
                event.stopImmediatePropagation();
				event.preventDefault();
				this.do_not_show_next_random_photo = false;
				document.getElementById("extension-photo-frame-print-button-container").classList.remove('extension-photo-frame-print-button-show-confirmation');
			});
			
			
			// Clicking on photo
            this.view.querySelector('#extension-photo-frame-picture-holder').addEventListener('click', () => {
                if (this.showing_screensaver == false) {
                    //var menu_button = document.getElementById("menu-button");
                    //menu_button.click(); //dispatchEvent('click');
                }
				if(!this.screensaver_ignore_click){
					window.last_activity_time = new Date().getTime();
				}
				//this.next_photo();
            });
			
			
			this.view.querySelector('#extension-photo-frame-add-random-photo-button').addEventListener('click', () => {
				if (this.debug) {
					console.log("add random photo button clicked");
				}
				const random_photo_button_el = this.view.querySelector('#extension-photo-frame-add-random-photo-button');
				random_photo_button_el.style.display = 'none';
				window.API.postJson(
	                `/extensions/photo-frame/api/get_random`,
	            ).then((body) => {
	                if (this.debug) {
						console.log("get_random photo response: ", body);
					}
					if(typeof body['data'] != 'undefined'){
	                    this.filenames = body['data'];
						this.ensure_privacy_mode();
	                    this.show_list(body['data']);
		                this.show_file(this.filenames[this.filenames.length-1]);
					}
					random_photo_button_el.style.display = 'block';
	                
	            }).catch((e) => {
	                console.error("Photo frame: error doing get_random photo: ", e);
					random_photo_button_el.style.display = 'block';
	            });
			});
			
			
			if(!this.view.querySelector('#extension-photo-frame-picture-holder').classList.contains('extension-photo-frame-has-swipe-listener')){
				const frame_holder_el = this.view.querySelector('#extension-photo-frame-picture-holder');
				frame_holder_el.classList.add('extension-photo-frame-has-swipe-listener');
			
				frame_holder_el.addEventListener('touchstart', e => {
					if(this.debug){
						console.log("photo-frame debug: touch start");
					}
					this.touchstartX = e.changedTouches[0].screenX;
				}, {
            		passive: true
        		});

				frame_holder_el.addEventListener('touchend', e => {
					this.touchendX = e.changedTouches[0].screenX;
					this.check_swipe_direction();
				}, {
            		passive: true
        		});
			}
			
			
			
			
			
			// LOCALSEND
			
			const localsend_checkbox_el = this.view.querySelector('#extension-photo-frame-enable-localsend-checkbox');
			if(localsend_checkbox_el){
				localsend_checkbox_el.addEventListener('change', () => {
		            window.API.postJson(
		                `/extensions/${this.id}/api/ajax`, {
		                    'action': 'set_localsend',
							'state': localsend_checkbox_el.checked
		                }
		            ).then((body) => {
						if(this.debug){
							console.log("photo frame debug: set_localsend response: ", body);
						}
						if(typeof body.localsend_name == 'string'){
							this.view.querySelector('#extension-photo-frame-localsend-name').textContent = body.localsend_name;
						}
			
		            }).catch((err) => {
		                if (this.debug) {
							console.error("photo frame debug: caught error doing set_localsend request: ", err);
						}
		            });
	            });
				
				this.view.querySelector('#extension-photo-frame-show-localsend-explanation-button').addEventListener('click', () => {
					this.view.querySelector('#extension-photo-frame-show-localsend-explanation-button').remove();
					this.view.querySelector('#extension-photo-frame-localsend-explanation').classList.remove('extension-photo-frame-hidden');
	            });
			}
			
			
			
			
			
			
			// PRIVACY MODE
			
			this.view.querySelector('#extension-photo-frame-privacy-mode-image-wrapper').addEventListener('click', () => {
				this.view.querySelector('#extension-photo-frame-privacy-mode-speech-bubble-text').textContent = this.sentences[Math.floor(Math.random() * this.sentences.length)];
            });
			
			this.view.querySelector('#extension-photo-frame-select-safe-photos-button').addEventListener('click', () => {
				if(this.busy_selecting_safe_photos){
					this.busy_selecting_safe_photos = false;
					overview_el.classList.remove('extension-photo-frame-privacy-mode-selecting-photos');
					this.update_privacy_mode_photos();
				}
				else{
					this.busy_selecting_safe_photos = true;
					overview_el.classList.add('extension-photo-frame-privacy-mode-selecting-photos');
					this.view.querySelector('#extension-photo-frame-photos-list').scrollIntoView({ behavior: 'smooth' });
				}
				
            });
			
			this.view.querySelector('#extension-photo-frame-cancel-selecting-button').addEventListener('click', () => {
				this.busy_selecting_safe_photos = false;
				overview_el.classList.remove('extension-photo-frame-privacy-mode-selecting-photos');
            });
			
			this.view.querySelector('#extension-photo-frame-done-selecting-button').addEventListener('click', () => {
				this.busy_selecting_safe_photos = false;
				overview_el.classList.remove('extension-photo-frame-privacy-mode-selecting-photos');
				this.update_privacy_mode_photos();
            });
			
			const privacy_mode_local_checkbox_el = this.view.querySelector('#extension-photo-frame-privacy-mode-local-checkbox');
			privacy_mode_local_checkbox_el.checked = this.privacy_mode_only_in_this_browser;
			privacy_mode_local_checkbox_el.addEventListener('change', () => {
				this.privacy_mode_only_in_this_browser = privacy_mode_local_checkbox_el.checked;
				localStorage.setItem('extension-photo-frame-privacy-mode-only-in-this-browser', this.privacy_mode_only_in_this_browser);
            });
			
			// 2 minutes privacy mode button
			const two_mimnutes_button_el = this.view.querySelector('#extension-photo-frame-privacy-mode-2minutes-button');
			if(two_mimnutes_button_el){
				two_mimnutes_button_el.addEventListener('click', () => {
					if (this.debug) {
						console.log("photo frame debug: enabling privacy mode for 2 minutes");
					}
					this.start_privacy_mode((120000), two_mimnutes_button_el);
				});
			}
			
			this.view.querySelector('#extension-photo-frame-privacy-mode-1hour-button').addEventListener('click', () => {
				//console.log("enabling privacy mode for 1 hour");
				this.start_privacy_mode((3600000), this.view.querySelector('#extension-photo-frame-privacy-mode-1hour-button'));
			});
			
			this.view.querySelector('#extension-photo-frame-privacy-mode-4hours-button').addEventListener('click', () => {
				//console.log("enabling privacy mode for 4 hours");
				this.start_privacy_mode((3600000 * 4), this.view.querySelector('#extension-photo-frame-privacy-mode-4hours-button'));
			});
			
			this.view.querySelector('#extension-photo-frame-privacy-mode-9pm-button').addEventListener('click', () => {
				//console.log("enabling privacy mode until 9 pm");
				
				let start_of_day = Date.now();
				start_of_day = start_of_day - (start_of_day % (3600000 * 24));
				const ninepm = start_of_day + (3600000 * 21);
				this.start_privacy_mode(ninepm, this.view.querySelector('#extension-photo-frame-privacy-mode-9pm-button'));
			});
			
			this.view.querySelector('#extension-photo-frame-privacy-mode-noon-tomorrow-button').addEventListener('click', () => {
				//console.log("enabling privacy mode until noon tomorrow");
				
				let start_of_day = Date.now();
				start_of_day = start_of_day - (start_of_day % (3600000 * 24));
				const noon_tomorrow = start_of_day + (3600000 * 36);
				this.start_privacy_mode(noon_tomorrow, this.view.querySelector('#extension-photo-frame-privacy-mode-noon-tomorrow-button'));
			});
			
			this.view.querySelector('#extension-photo-frame-privacy-mode-3days-button').addEventListener('click', () => {
				//console.log("enabling privacy mode for 3 days");
				
				let start_of_day = Date.now();
				start_of_day = start_of_day - (start_of_day % (3600000 * 24));
				const threedays = Date.now() + (3600000 * 24 * 3);
				this.start_privacy_mode(threedays, this.view.querySelector('#extension-photo-frame-privacy-mode-3days-button'));
			});
			
			
			// SETTINGS CHECKBOXES
			
			// Unlock sound
			this.view.querySelector('#extension-photo-frame-unlock-sound-checkbox').addEventListener('change', () => {
	            window.API.postJson(
	                `/extensions/${this.id}/api/ajax`, {
	                    'action': 'save_setting',
						'setting': 'unlock_sound',
						'value':this.view.querySelector('#extension-photo-frame-unlock-sound-checkbox').checked
	                }
	            ).then((body) => {
					if(this.debug){
						console.log("photo frame debug: save unlock-sound setting response: ", body);
					}
			
	            }).catch((err) => {
	                if (this.debug) {
						console.error("Photo frame debug: caught error saving unlock-sound setting: ", err);
					}
	            });
			});
			
			this.view.querySelector('#extension-photo-frame-test-sound-button').addEventListener('click', () => {
				this.play_a_sound();
			});
			
			
			// Allow screensaver
			/*
			const allow_screensaver_checkbox_el = this.view.querySelector('#candle_screensaver_enabled-checkbox');
			if(this.debug){
				console.log("photo frame debug: show: setting allow_screensaver checkbox to: ", this.screensaver_allowed_in_this_browser);
			}
			allow_screensaver_checkbox_el.checked = this.screensaver_allowed_in_this_browser;
			allow_screensaver_checkbox_el.addEventListener('change', () => {
	            if(this.screensaver_allowed_in_this_browser == true){
	            	this.screensaver_allowed_in_this_browser = false;
					localStorage.setItem('candle_screensaver_enabled', 'false');
	            }
				else{
					this.screensaver_allowed_in_this_browser = true;
					localStorage.setItem('candle_screensaver_enabled', 'true');
				}
				if(this.debug){
					console.log("photo frame debug: this.screensaver_allowed_in_this_browser is now: ", this.screensaver_allowed_in_this_browser);
				}
				
			});
			*/
			
			
			/*
			this.view.querySelector('#extension-photo-frame-create-thing-checkbox').addEventListener('change', () => {
	            window.API.postJson(
	                `/extensions/${this.id}/api/ajax`, {
	                    'action': 'save_setting',
						'setting': 'create_thing',
						'value':this.view.querySelector('#extension-photo-frame-create-thing-checkbox').checked
	                }
	            ).then((body) => {
					if(this.debug){
						console.log("photo frame debug: save create_thing setting response: ", body);
					}
			
	            }).catch((err) => {
	                if (this.debug) {
						console.error("Photo frame debug: caught error saving create_thing setting: ", err);
					}
	            });
			});
			*/
			
			
			// Use password
			this.view.querySelector('#extension-photo-frame-enable-password-checkbox').addEventListener('blur', () => {
				
				let password = null;
				const is_checked = this.view.querySelector('#extension-photo-frame-enable-password-checkbox').checked;
				if(is_checked){
					const password_input_el = this.view.querySelector('#extension-photo-frame-privacy-mode-password');
					password = password_input_el.value.trim();
					const fresh_password_length = password.length;
					if(password_length > 2){
						this.password_length = fresh_password_length;
						crypto.subtle.digest("SHA-384", new TextEncoder().encode('candlesalt' + password))
						.then((hashBuffer) => {
							const hashArray = Array.from(new Uint8Array(hashBuffer));
						    this.password_hash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
						    
							if(this.debug){
								console.log("photo frame debug: saving this.password_hash: ", this.password_hash);
							}
						    return window.API.postJson(
				                `/extensions/${this.id}/api/ajax`, {
				                    'action': 'enable_password',
									'enabled': is_checked,
									'password_hash':this.password_hash,
									'password_length':this.password_length
				                }
				            )
						})
						.then((body) => {
							if(this.debug){
								console.log("photo frame debug: save create_thing setting response: ", body);
							}
							if(body.state === true){
								password_input_el.classList.add('extension-photo-frame-green-bg');
								setTimeout(() => {
									password_input_el.classList.remove('extension-photo-frame-green-bg');
								},1000);
								password_input_el.value = '';
								let password_placeholder = '';
								for(let pl = 0; pl < password_length; pl++){
									password_placeholder += '*';
								}
								password_input_el.setAttribute('placeholder',password_placeholder);
								localStorage.setItem('extension-photo-frame-password-hash',this.password_hash);
								localStorage.setItem('extension-photo-frame-password-length','' + this.password_length);
								
							}

						}).catch((err) => {
							if (this.debug) {
								console.error("Photo frame debug: caught error saving password setting: ", err);
							}
						});
					}
					else{
						this.flash_message('The password should be at least 3 characters');
						password_input_el.value = '';
						password_input_el.setAttribute('placeholder','Not long enough');
					}
					
				}
				else{
					
		            window.API.postJson(
		                `/extensions/${this.id}/api/ajax`, {
		                    'action': 'enable_password',
							'value':false
		                }
		            ).then((body) => {
						if(this.debug){
							console.log("photo frame debug: disable password setting response: ", body);
						}
						
						if(localStorage.getItem('extension-photo-frame-password-hash')){
							localStorage.removeItem('extension-photo-frame-password-hash');
						}
						if(typeof localStorage.getItem('extension-photo-frame-password-length') == 'string'){
							localStorage.removeItem('extension-photo-frame-password-length');
						}
						localStorage.setItem('extension-photo-frame-password-enabled','false');
			
		            }).catch((err) => {
		                if (this.debug) {
							console.error("Photo frame debug: caught error saving disabled password setting: ", err);
						}
		            });
					
					
				}
			});
			
			
			
			this.get_list();
            
			this.ensure_thing_subscription();
			
			
			

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
			try{
				window.setTimeout(() => {
					const photo_frame_main_menu_item_el = document.getElementById('extension-photo-frame-menu-item');
					if(photo_frame_main_menu_item_el){
						if(photo_frame_main_menu_item_el.classList.contains('selected') == false){
							if(this.debug){
								console.error("photo frame: hide(): clearing html");
							}
							this.view.innerHTML = "";
						}
					}
				},1000);
				
			}
			catch(err){
				console.error("photo frame: caught error clearing HTML in hide: ", err);
			}
			
			/*
            try {
                window.clearInterval(this.photo_interval);
				this.photo_interval = null;
            } catch (e) {
                //console.warn("photo frame: error, could not clear photo rotation interval");
            }
			
			
			try{
				//document.removeEventListener("keydown", this.list);
				
				document.removeEventListener("keydown", this.photo_frame_key_listener);
				//console.log("photo frame: hide: past event listener removal");
			}
			catch(e){
				if(this.debug){
					console.error("photo frame: hide: no keylistener to remove? ", e);
				}
				
			}
			*/
			
			/*
            try {
				//document.body.removeEventListener("keydown", this.photo_frame_key_listener, { passive: true });
            } catch (e) {
                console.warn("photo frame: error removing key listener: ", e);
            }
			*/

        }

		// Called only once, and will run in the background continuously
		start_main_interval(){
            this.photo_interval = setInterval(() => {
				
				if(this.debug){
					//console.log("in photo_interval.  interval_counter,slow_interval_counter: ", this.interval_counter, this.slow_interval_counter);
				}
				if(this.page_visible){
					
					this.interval_counter++;
					this.slow_interval_counter++
				
					/*
					const screensaver_allowed_check = localStorage.getItem('candle_screensaver_enabled');
					if(typeof screensaver_allowed_check == 'string'){
						if(screensaver_allowed_check == 'true'){
							this.screensaver_allowed_in_this_browser = true;
						}
						else{
							this.screensaver_allowed_in_this_browser = false;
						}
					}else{
						this.screensaver_allowed_in_this_browser = false;
					}
					
					
					if(this.showing_screensaver && this.screensaver_allowed_in_this_browser == false && this.screensaver_allowed_in_this_browser_once == false){
						window.last_activity_time = new Date().getTime();
					}
					*/
					
				
					// change to new random picture after X seconds
	                if (this.interval_counter > this.interval) {
						this.interval_counter = 0;
	                    this.random_picture();
	                }
		
		
					// Every X seconds run the slow update of settings
					if (this.slow_interval_counter > this.slow_interval) {
						this.slow_interval_counter = 0;
			
						this.get_list();
					}
		
					/*
					if((this.screensaver_allowed_in_this_browser || this.screensaver_allowed_in_this_browser_once) && this.screensaver_delay){
						
						if(this.screensaver_listeners_added == false){
							this.start_screensaver_listeners();
						}
		
						if(this.screensaver_interval_busy == false){
							//console.log("calling do_screensaver_interval");
							//this.do_screensaver_interval();
						}
						else if(this.debug){
							console.warn("photo frame debug: screensaver_interval was still busy, skipping calling it again");
							this.screensaver_interval_busy = false; // but only skipping it once
						}
						
					}
					else if(this.showing_screensaver){
						// Run it one more time to clean it up
						window.last_activity_time = new Date().getTime();
						//this.do_screensaver_interval();
					}
					*/
					
		
		
					// every X seconds run the Voco timers poll interval
					if (window.location.pathname == "/extensions/photo-frame") {
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
			
		
						//console.log("this.show_clock: ", this.show_clock);
						// Every minute on the minute update the clock
						if (this.show_clock || this.show_date) {
							if ( new Date().getSeconds() === 0 ){
								this.update_clock();
							}
						}
					}
				
				
					
				
					this.ensure_privacy_mode();
					
					/*
					if (window.location.pathname == "/extensions/photo-frame") {
						
						
					}
					else{
						this.interval_counter = 0;
					}
					*/
					
				}
				
                //console.log(this.interval_counter);
				
            }, 1000);
			
		}

		



		//
		//   INIT - get regular updates about settings and available photos
		//

        
		// This is called regularly, for example to make the photo frame reflect any photos that were added on another device
		get_list(){
			if(this.debug){
				console.log("photo frame debug: in get_list");
			}
			
			if(this.busy_getting_list == false){
				this.busy_getting_list = true;
				if(this.debug){
					console.log("photo frame debug: get_list: requesting list");
				}
	            window.API.postJson(
	                `/extensions/${this.id}/api/list`, {
	                    'init': 1
	                }
	            ).then((body) => {
		            this.parse_body(body);
				
					this.random_picture();

					this.show_list();
			
					this.update_clock();
					
					this.busy_getting_list = false;
			
	            }).catch((err) => {
	                if (this.debug) {
						console.log("Photo frame: caught error getting /list: ", err);
					}
					this.busy_getting_list = false;
	            });
			}
			else if(this.debug){
				console.warn("photo frame debug: already busy getting the list");
			}
		}
		
		
		
		
		update_privacy_mode_photos(){
			if(this.debug){
				console.log("in update_privacy_mode_photos");
			}
			let safe_photos = [];
			let thumbnail_els = this.view.querySelectorAll('.extension-photo-frame-list-item.extension-photo-frame-list-item-privacy-safe');
			for(let x = 0; x < thumbnail_els.length; x++){
				safe_photos.push(thumbnail_els[x].getAttribute('data-filename'));
			}
			if(this.debug){
				console.log("photo frame debug: new safe_photos: ", safe_photos);
			}
            window.API.postJson(
                `/extensions/${this.id}/api/ajax`, {
                    'action': 'save_safe_photos',
					'safe_photos':safe_photos
                }
            ).then((body) => {
				if(this.debug){
					console.log("photo frame debug: save_safe_photos_list response: ", body);
				}
				this.parse_body(body);
				this.show_list();
			
            }).catch((err) => {
                if (this.debug) {
					console.error("Photo frame debug: caught error calling save_safe_photos_list: ", err);
				}
            });
			
			
		}
		
		
		start_locked_mode(){
			document.body.classList.add('extension-photo-frame-locked');
			
			locked_overlay_el = document.getElementById('extension-photo-frame-locked-mode-overlay');
			if(!locked_overlay_el){
				const locked_mode_overlay_el = document.createElement('div');
				privacy_mode_overlay_el.setAttribute('extension-photo-frame-locked-mode-overlay');
				privacy_mode_overlay_el.classList.add('extension-photo-frame-hidden');
				
				const unlock_with_password_input_el = document.createElement('input');
				unlock_with_password_input_el.setAttribute('type','password');
				privacy_mode_overlay_el.appendChild(unlock_with_password_input_el);
				
				const unlock_with_password_button_el = document.createElement('button');
				unlock_with_password_button_el.classList.add('text-button');
				unlock_with_password_button_el.textContent = 'Unlock';
				unlock_with_password_button_el.addEventListener('click', () => {
					let password = unlock_with_password_input_el.value.trim();
					if(password.length > 2){
						crypto.subtle.digest("SHA-384", new TextEncoder().encode('candlesalt' + password))
						.then((hashBuffer) => {
							const hashArray = Array.from(new Uint8Array(hashBuffer));
						    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
						    if(hashHex == this.password_hash){
						    	if(this.debug){
						    		console.log("password match");
						    	}
						    }
							else{
						    	if(this.debug){
						    		console.warn("password do not match");
						    	}
							}
							
						})
						.catch((err) => {
							if (this.debug) {
								console.error("Photo frame debug: caught error hashing unlock password: ", err);
							}
						});
					}
				});
				
				document.body.appendChild(privacy_mode_overlay_el);
			}
			
		}
		
		
		
		
		start_privacy_mode(duration=null,button_el=null){
			if(this.debug){
				console.log("photo frame debug: in set_privacy_mode.  duration: ", duration);
			}
			
			if(typeof duration == 'number'){
				this.privacy_mode_end_time = Date.now() + duration;
				localStorage.setItem('extension-photo-frame-privacy-mode-end-time', this.privacy_mode_end_time);
				this.ensure_privacy_mode();
				if(this.privacy_mode_only_in_this_browser == false){
					if(this.debug){
						console.log("set_privacy_mode: sending end time to backend");
					}
		            window.API.postJson(
		                `/extensions/${this.id}/api/ajax`, {
		                    'action': 'save_privacy_mode_end_time',
							'value': this.privacy_mode_end_time
		                }
		            ).then((body) => {
						if(this.debug){
							console.log("photo frame debug: save privacy_mode_end_time setting response: ", body);
						}
						if(button_el){
							button_el.classList.add('extension-photo-frame-green-bg');
							setTimeout(() => {
								button_el.classList.remove('extension-photo-frame-green-bg');
							},1000);
						}
						
		
		            }).catch((err) => {
		                if (this.debug) {
							console.error("Photo frame debug: caught error saving privacy_mode_end_time setting: ", err);
						}
		            });
				}
			}
			
		}
		
		
		ensure_privacy_mode(){
			if(this.privacy_mode_end_time > Date.now()){
				this.privacy_mode_enabled = true;
				document.body.classList.add('extension-photo-frame-privacy-mode');
				try{
					for(let x = this.filenames.length - 1; x >= 0; x--){
						if(this.safe_photos.indexOf(this.filenames[x]) == -1){
							if(this.debug){
								console.log("photo frame debug: ensure_privacy_mode: removing photo from this.filenames: " + this.filenames[x]);
							}
							this.filenames.splice(x,1);
						}
					}
				}
				catch(err){
					console.error('photo frame: caught error in ensure_privacy_mode: ', err);
				}
				
			}
			else{
				this.privacy_mode_enabled = false;
				document.body.classList.remove('extension-photo-frame-privacy-mode');
			}
		}
		
		






		//
		//  CHANGE CURRENTLY SHOWN PHOTO
		//
		
		
		// swipe left or right on a photo to navigate between them
		check_swipe_direction() {
			//window.last_activity_time = new Date().getTime();
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
				console.log("photo frame debug: previous_picture: before this.current_photo_number: ", this.current_photo_number);
			}
			this.current_photo_number--;
			if(this.current_photo_number < 0){
				this.current_photo_number = this.filenames.length - 1;
			}
			this.show_file( this.filenames[this.current_photo_number], true); // true = instant change
			if(this.debug){
				console.log("photo-frame debug: previous_picture: after this.current_photo_number: ", this.current_photo_number);
			}
			this.show_selected_photo_indicator();
		}


		next_picture(){
			if(this.debug){
				console.log("photo-frame debug: next_picture: before this.current_photo_number: ", this.current_photo_number);
			}
			this.current_photo_number++;
			if(this.current_photo_number >= this.filenames.length){
				this.current_photo_number = 0;
			}
			this.show_file( this.filenames[this.current_photo_number], true); // true = instant change
			if(this.debug){
				console.log("photo-frame debug: next_picture: after this.current_photo_number: ", this.current_photo_number);
			}
			this.show_selected_photo_indicator();
		}


        random_picture() {
            if (this.filenames.length > 0 && this.do_not_show_next_random_photo == false) {
				if(this.debug){
					//console.log("photo frame: random_picture: before this.current_photo_number: ", this.current_photo_number);
				}
				let new_pic_nr = Math.floor(Math.random() * this.filenames.length);
				if(new_pic_nr == this.current_photo_number){
					new_pic_nr = Math.floor(Math.random() * this.filenames.length);
				}
				if(new_pic_nr == this.current_photo_number){
					new_pic_nr = Math.floor(Math.random() * this.filenames.length);
				}
				
				this.current_photo_number = new_pic_nr;
				if(this.debug){
					console.log("photo-frame debug: random_picture: after this.current_photo_number: ", this.current_photo_number);
				}
                var random_file = this.filenames[this.current_photo_number];
				if(this.debug){
					console.log("photo-frame debug: new random picture: /extensions/photo-frame/photos/" + random_file);
				}
                this.show_file(random_file);
            }
        }


        show_file(filename,instant=false) {
			if(this.debug){
				console.log("photo-frame debug:  show_file. filename: ", filename);
			}
			
			const picture_holder = document.getElementById('extension-photo-frame-picture-holder');
			if(picture_holder == null){
				return
			}
			
			// filename for printing
			document.getElementById("extension-photo-frame-print-confirm-button").setAttribute('data-photo-name',filename);

            const picture1 = document.getElementById('extension-photo-frame-picture1');
            const picture2 = document.getElementById('extension-photo-frame-picture2');
            //const overview = document.getElementById('extension-photo-frame-overview');
            //console.log("showing photo: " + filename);

			//picture1.style['transform-origin'] = 'center';
			
			
			

            if (this.current_picture == 1) {
                this.current_picture = 2;
				
				if(this.animations){
					//picture2.classList.add('extension-photo-frame-invisible');
				}
				
                picture2.style.backgroundImage = 'url("/extensions/photo-frame/photos/' + filename + '")';
                picture2.classList.add('extension-photo-frame-current-picture');
				//picture2.classList.remove('extension-photo-frame-fade-out');
				picture1.classList.remove('extension-photo-frame-current-picture');
				
				
				//picture2.classList.add('extension-photo-frame-current-top-picture');
				//picture1.classList.remove('extension-photo-frame-current-top-picture');
				
				
                setTimeout(() => {
                    //picture1.classList.remove('extension-photo-frame-current-picture');
                }, 500);
				
				if(instant){
					picture1.classList.remove('extension-photo-frame-top-picture');
					picture2.classList.add('extension-photo-frame-top-picture');
				}
				else{
	                setTimeout(() => {
	                    //picture2.classList.remove('extension-photo-frame-invisible')
						//picture2.classList.add('extension-photo-frame-fade-out');
						picture1.classList.remove('extension-photo-frame-top-picture');
						picture2.classList.add('extension-photo-frame-top-picture');
					
	                }, 4000);
				}
                

                // Also update the list of photos.

            } else {
                // Switching from picture 2 to back to picture 1
                this.current_picture = 1;
				
				if(this.animations){
					//picture1.classList.add('extension-photo-frame-invisible');
				}
				
                picture1.style.backgroundImage = "url(/extensions/photo-frame/photos/" + filename + ")";
                picture1.classList.add('extension-photo-frame-current-picture');
				picture2.classList.remove('extension-photo-frame-current-picture');
				
				if(instant){
					picture1.classList.add('extension-photo-frame-top-picture');
					picture2.classList.remove('extension-photo-frame-top-picture');
				}
				else{
	                setTimeout(() => {
	                    //picture2.classList.remove('extension-photo-frame-invisible')
						//picture2.classList.add('extension-photo-frame-fade-out');
						picture1.classList.add('extension-photo-frame-top-picture');
						picture2.classList.remove('extension-photo-frame-top-picture');
					
	                }, 4000);
				}
				
				//picture2.classList.add('extension-photo-frame-fade-out');
				//picture1.classList.add('extension-photo-frame-current-top-picture');
				//picture2.classList.remove('extension-photo-frame-current-top-picture');
				/*
                setTimeout(() => {
                    //picture2.classList.remove('extension-photo-frame-current-picture');
                }, 500);
				
                setTimeout(() => {
                    //picture1.classList.remove('extension-photo-frame-invisible')
                }, 4000);
				*/
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
							//console.log("image width: ", roi_image.width);
							//console.log("image height: ", roi_image.height);
							//console.log("smartcrop result: ", result.x,result.y,result.width,result.height);
							//console.log("window.innerWidth: ", window.innerWidth);
							//console.log("window.clientWidth: ", window.clientWidth);
							
							//window.innerWidth / 2
							//roi_image.width
							
							//.clientWidth/Height
							let center_x = roi_image.width / 2;
							let center_y = roi_image.height / 2;
							//console.log("center_x: ", center_x);
							
							
							let transform_x = result.x + (result.width / 2);
							let transform_y = result.y + (result.height / 2);
							const transform_x_orig = transform_x;
							
							//console.log("transform_x: ", transform_x);
							
							let transform_x_percentage = (transform_x / roi_image.width) * 100;
							let transform_y_percentage = (transform_y / roi_image.height) * 100;
							//console.log("transform_x_percentage: ", transform_x_percentage);
							//console.log("transform_y_percentage: ", transform_y_percentage);
							
							
							if(transform_x < window.innerWidth / 2){
								//transform_x = window.innerWidth;
							}
							if(transform_x < window.innerWidth / 2){
								//transform_x = window.innerWidth;
							}
							
							
							
							if(transform_x < center_x){
								transform_x = transform_x + ((center_x-transform_x) /2);
							}
							else if(transform_x > center_x){
								transform_x = transform_x - ((transform_x-center_x) /2);
							}
							
							
							
							//console.log("center x: ", result.x + (result.width / 2));
							
						
						
							//let transform_center = Math.round(transform_x) + 'px ' + Math.round(transform_y) + 'px';
							let transform_center = Math.round(transform_x_percentage) + '% ' + Math.round(transform_y_percentage) + '%';
							if(this.debug){
								//console.log("photo frame: smartcrop ROI: transform_center: ", transform_center);
				            }
							
							if (this.current_picture == 1) {
				                picture1.style['transform-origin'] = transform_center;
								picture1.classList.remove('extension-photo-frame-effect');
								setTimeout(() => {
									picture1.classList.add('extension-photo-frame-effect');
									//picture1.classList.remove('extension-photo-frame-invisible');
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
									//picture2.classList.remove('extension-photo-frame-invisible');
									
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
				//picture1.classList.remove('extension-photo-frame-invisible');
				//picture2.classList.remove('extension-photo-frame-invisible');
				picture1.classList.remove('extension-photo-frame-effect');
				picture2.classList.remove('extension-photo-frame-effect');
			}




            //this.interval_counter = 0;
        }


		show_selected_photo_indicator(){
			if(this.debug){
				console.log("photo frame debug: in show_selected_photo_indicator");
			}
			
			if(this.filenames.length){
				let selected_photo_indicator_container_el = document.getElementById('extension-photo-frame-selected-photo-indicator-container');
				this.hide_selected_photo_indicator_time = new Date().getTime() + 1000;
				if(selected_photo_indicator_container_el){
					selected_photo_indicator_container_el.innerHTML = '';
					
					let indicator_container_el = document.createElement('div');
			
					for (let i = 0; i < this.filenames.length; i++) {
						let indicator_el = document.createElement('div');
				
						if(i == this.current_photo_number){
							if(this.debug){
								console.log("photo frame debug: show_selected_photo_indicator: at current photo number: ", i);
							}
							indicator_el.classList.add('extension-photo-frame-selected-photo-indicator-current');
						}
			
						indicator_container_el.appendChild(indicator_el);
				
					}
					selected_photo_indicator_container_el.appendChild(indicator_container_el);
			
					setTimeout(() => {
						if( new Date().getTime() > this.hide_selected_photo_indicator_time){
							selected_photo_indicator_container_el.innerHTML = '';
						}
					},1002);
				}
				
			
				
			}
			
		}
		
		
		
		
		
		
		
		




		//
		//   PRINT
		//

        print_file(filename) {
            if(this.debug){
				console.log('photo frame debug: in print_file.  filename: ', filename);
			}
            window.API.postJson(
                `/extensions/${this.id}/api/print`, {
                    'action': 'print',
                    'filename': filename
                }
            ).then((body) => {
                if(this.debug){
					console.log('photo frame debug: file sent to printer. response: ', body);
				}
            }).catch((err) => {
                if(this.debug){
					console.error("photo frame: caught error in print response: ", err);
				}
                this.flash_message("Could not print file - connection error?");
            });
        }




		//
		//  CLOCK OVERLAY
		//


        update_clock() {
			//console.log("in update_clock.  show_clock,show_date: ", this.show_clock, this.show_date);
            if (this.show_clock || this.show_date) {
				
                window.API.postJson(
                    `/extensions/photo-frame/api/get_time`,
                ).then((body) => {
                    if (typeof body.hours != 'undefined') {

                        var hour_padding = "";
                        var minute_padding = "";

						//console.warn("document.getElementById('extension-photo-frame-clock'): ", document.getElementById('extension-photo-frame-clock'));
						
						const clock_el = this.view.querySelector('#extension-photo-frame-clock')
                        if (this.show_clock && clock_el) {
                            clock_el.innerText = body.hours + ":" + minute_padding + body.minutes;
                        }
						
						const date_day_el = this.view.querySelector('#extension-photo-frame-date-day');
                        if (this.show_date && date_day_el) {

                            // Day name
                            const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                            
                            var nice_day_name = body.day_name
                            for (let i = 0; i < days.length; i++) {
                                if(days[i].startsWith(body.day_name) ){
                                    nice_day_name = days[i];
                                }
                            }
                            date_day_el.innerText = nice_day_name; //days[date.getDay()];

                            // Day of month
                            this.view.querySelector('#extension-photo-frame-date-date').innerText = body.date; //date.getDate();

                            // Month name
                            const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                            this.view.querySelector('#extension-photo-frame-date-month').innerText = body.month; //months[date.getMonth()];
                        }
                    }
                }).catch((err) => {
                    if(this.debug){
						console.error("photo frame debug: caught error getting date/time: ", err);
					}
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
							console.log("photo frame debug: weather temperature property: ", prop);
						}
                        let temperature_el = this.view.querySelector('#extension-photo-frame-weather-temperature');
                        if (temperature_el != null) {
                            this.view.querySelector('#extension-photo-frame-weather-temperature').innerText = prop;
                            //document.getElementById('extension-photo-frame-weather-description').innerText = things[key]['properties']['description']['value'];
                        } else {
                            //console.log('weather temperature element did not exist yet');
                        }
                    }).catch((e) => {
                        if(this.debug){
							console.log("photo frame debug: update_weather: error getting temperature property: ", e);
						}
						this.weather_fail_count = 10;
                    });


                	//API.getJson(this.weather_thing_url + '/properties/description')
					API.getJson(this.weather_thing_url + '/properties/current_description')
                    .then((prop) => {
                        if(this.debug){
							console.log("photo frame debug: weather current_description property: ", prop);
						}
                        let description_el = this.view.querySelector('#extension-photo-frame-weather-description');
                        if (description_el != null) {
                            description_el.innerText = prop;
                        } else {
                            //console.log('weather description element did not exist yet');
                        }
                    }).catch((e) => {
                        if(this.debug){
							console.log("photo frame debug: update_weather: error getting current_description property: ", e);
						}
						this.weather_fail_count = 10;
                    });
				}
				if(this.weather_fail_count > 0){
					if(this.debug){
						console.warn("photo frame debug: there was an error polling the Candle weather thing. Delaying a while before trying again. this.weather_fail_count: ", this.weather_fail_count);
					}
					this.weather_fail_count--;
				}
				
                
            } else {
                if(this.debug){
					console.warn('photo frame debug: warning, in update_weather, but no thing url');
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
			if(this.busy_polling == false){
	            this.busy_polling = true;
				window.API.postJson(
	                `/extensions/photo-frame/api/poll`,
	            ).then((body) => {
	                if (this.debug) {
						//console.log("photo-frame: voco actions: ", body);
					}
					this.poll_fail_count = 0;
					this.busy_polling = false;
				
	            }).catch((e) => {
	                if (this.debug) {
						console.error("Photo frame debug: error doing periodic poll for voco actions: ", e);
					}
					this.poll_fail_count = 3; // delays 3 * 5 seconds
					this.busy_polling = false;
	            });
			}
            else{
            	if(this.debug){
            		console.warn("photo frame debug: get_poll: aborting, busy_polling (for voco timers) was true");
            	}
            }
        }
		
		
		parse_body(body){
			
			if(typeof body.debug != 'undefined'){
				this.debug = body.debug;
			}
			
            if (this.debug) {
                console.log("photo-frame debug: parse_body:  body: ", body);
            }
			
            if(typeof body.night_mode == 'boolean'){
				this.night_mode = body.night_mode;
            	if(this.night_mode){
            		document.body.classList.add('extension-photo-frame-night-mode');
            	}
				else{
					document.body.classList.remove('extension-photo-frame-night-mode');
				}
            }
			
			if(typeof body.added_a_photo == 'boolean'){
				this.added_a_photo = body.added_a_photo;
				if(this.added_a_photo){
					this.view.classList.add('extension-photo-frame-added-a-photo');
				}
			}
			
			if(typeof body.localsend_name == 'string'){
				const localsend_name_el = this.view.querySelector('#extension-photo-frame-localsend-name');
				if(localsend_name_el){
					localsend_name_el.textContent = body.localsend_name;
				}
			}
			if(typeof body.localsend_messages != 'undefined'){
				const localsend_messages_el = this.view.querySelector('#extension-photo-frame-localsend-messages');
				if(localsend_messages_el){
					localsend_messages_el.textContent = body.localsend_messages; //JSON.stringify(body.localsend_messages,null,2);
				}
			}
			if(typeof body.localsend_running == 'boolean'){
				const localsend_checkbox_el = this.view.querySelector('#extension-photo-frame-enable-localsend-checkbox');
				if(localsend_checkbox_el){
		            if (this.debug) {
		                console.log("photo-frame debug: setting localsend checkbox to: ", body.localsend_running);
		            }
					localsend_checkbox_el.checked = body.localsend_running;
				}
			}
			
			if(typeof body['password_hash'] == 'string'){
				this.password_hash = body['password_hash'];
			}
			if(typeof body['password_enabled'] == 'boolean'){
				const password_checkbox_el = this.view.querySelector('#extension-photo-frame-enable-password-checkbox');
				if(password_checkbox_el){
					password_checkbox_el.checked = body['password_enabled'];
				}
			}
			if(typeof body['password_length'] == 'number'){
				this.password_length = body['password_length'];
				const password_input_el = this.view.querySelector('#extension-photo-frame-privacy-mode-password');
				if(password_input_el){
					password_input_el.value = '';
					let password_placeholder = '';
					for(let pl = 0; pl < body['password_length']; pl++){
						password_placeholder += '*';
					}
					password_input_el.setAttribute('placeholder',password_placeholder);
				}
			}
			
			if(typeof body['safe_photos'] != 'undefined'){
				this.safe_photos = body['safe_photos'];
			}
			if(typeof body['privacy_mode_end_time'] == 'number'){
				this.privacy_mode_end_time = body['privacy_mode_end_time'];
				this.ensure_privacy_mode();
			}
			
				
			if(typeof body['interval'] != 'undefined'){
                this.interval = parseInt(body['interval']);
                this.fit_to_screen = body['fit_to_screen'];
                this.show_date = body['show_date'];
				this.greyscale = body['greyscale'];
				this.animations = body['animations'];
			}
			
			if(typeof body['show_clock'] == 'boolean'){
				this.show_clock = body['show_clock'];
			}
			if(typeof body['show_date'] == 'boolean'){
				this.show_date = body['show_date'];
			}

			// weather
            if (typeof body.show_weather == 'boolean') {
                this.show_weather = body.show_weather;
                //console.log('body.show_weather: ', body.show_weather);
            }
            
			// Voco timers
			if(typeof body.show_voco_timers == 'boolean'){
				this.show_voco_timers = body.show_voco_timers;
			}

			if(this.show_voco_timers && typeof body.action_times != 'undefined'){
				const previous_action_times_length = this.action_times.length;
				this.action_times = body.action_times;
				if(this.action_times.length != previous_action_times_length){
					this.update_voco_actions();
					if(this.debug){
						console.log("photo frame debug: get_poll: new Voco action_times: ", this.action_times);
					}
				}
			}
			
			// printer
            if (typeof body.printing_allowed == 'boolean' && typeof body.peripage_printer_available == 'boolean' && typeof body.cups_printer_available == 'boolean') {
                this.printing_allowed = body.printing_allowed;
				this.peripage_printer_available = body.peripage_printer_available;
				this.cups_printer_available = body.cups_printer_available;
            }
			
			if(this.printing_allowed && (this.peripage_printer_available || this.cups_printer_available)){
				this.view.classList.add('extension-photo-frame-printer-available');
			}
			else{
				this.view.classList.remove('extension-photo-frame-printer-available');
			}
			
            
			
			// Update HTML based on (potentially changed) settings
			if (this.view.querySelector('#extension-photo-frame-content')) { //  && this.do_not_show_next_random_photo == false

				// photo data
				if(typeof body['data'] != 'undefined'){
					const previous_length = this.filenames.length;
					//console.log("--previous_length: ", previous_length);
					
                    this.filenames = body['data'];
					this.ensure_privacy_mode();
					//console.log("--this.filenames.length: ", this.filenames.length);
					if(previous_length != this.filenames.length || this.show_list_called == false){
                    
						if(previous_length == 0){
							this.random_picture();
							this.update_clock();
							setTimeout(() => {
								if(this.show_list_called == false){
									this.show_list();
								}
							},1000);
						
						}
						else{
							this.show_list(body['data']);
						
						}
						/*
						else if(previous_length < this.filenames.length){
							this.show_file(this.filenames[this.filenames.length-1]); // this assumes the last photo in the list is the newest. But it's not.
						}
						*/
					}
				}

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
	                this.view.querySelector('#extension-photo-frame-date').classList.add('extension-photo-frame-show');
	            } else {
	                this.view.querySelector('#extension-photo-frame-date').classList.remove('extension-photo-frame-show');
	            }
	            if (this.show_clock) {
	                this.view.querySelector('#extension-photo-frame-clock').classList.add('extension-photo-frame-show');
	            } else {
	                this.view.querySelector('#extension-photo-frame-clock').classList.remove('extension-photo-frame-show');
	            }
            
				if(this.greyscale){
					this.view.querySelector('#extension-photo-frame-content').classList.add('extension-photo-frame-greyscale');
				}
				else{
					this.view.querySelector('#extension-photo-frame-content').classList.remove('extension-photo-frame-greyscale');
				}
			
                if (this.fit_to_screen == 'contain') {
                    //console.log("Contain the image");
                    this.view.querySelector('#extension-photo-frame-picture1').style.backgroundSize = "contain";
                    this.view.querySelector('#extension-photo-frame-picture2').style.backgroundSize = "contain";
                } else if (this.fit_to_screen == 'cover') {
                    //console.log("Do not contain the image");
                    this.view.querySelector('#extension-photo-frame-picture1').style.backgroundSize = "cover";
                    this.view.querySelector('#extension-photo-frame-picture2').style.backgroundSize = "cover";
                } else {
                    this.view.querySelector('#extension-photo-frame-picture1').style.backgroundSize = "cover";
                    this.view.querySelector('#extension-photo-frame-picture2').style.backgroundSize = "contain";
                }
			
				this.view.querySelector('#extension-photo-frame-picture1').style['animation-duration'] = (this.interval+1) + 's';
				this.view.querySelector('#extension-photo-frame-picture2').style['animation-duration'] = (this.interval+1) + 's';
				/*
				if(this.view.querySelector('#extension-photo-frame-screensaver-indicator')){
					this.view.querySelector('#extension-photo-frame-screensaver-indicator').style['animation-duration'] = this.screensaver_delay + 's';
					this.view.querySelector('#extension-photo-frame-start-screensaver-countdown-indicator').style['animation-duration'] = this.screensaver_delay + 's';
				}
				*/
				
            }
			
			// This does not parse the body, but checks if this value has been changed in a sibling browser window
			/*
			const screensaver_allowed_check = localStorage.getItem('candle_screensaver_enabled');
			if(typeof screensaver_allowed_check == 'string'){
				if(screensaver_allowed_check == 'true' && this.screensaver_allowed_in_this_browser != true){
					this.view.querySelector('#candle_screensaver_enabled-checkbox').checked = true;
					this.screensaver_allowed_in_this_browser = true;
				}
				else if(screensaver_allowed_check == 'false' && this.screensaver_allowed_in_this_browser != false){
					this.view.querySelector('#candle_screensaver_enabled-checkbox').checked = false;
					this.screensaver_allowed_in_this_browser = false;
				}
			}
			*/
			
			
		}
		
		
		
		// Update the HTML of Voco timers
		update_voco_actions(){
			let voco_overlay_el = this.view.querySelector('#extension-photo-frame-voco-container');
			
			const d = new Date();
			let time = Math.floor(d.getTime() / 1000);
			
			for (let i = 0; i < this.action_times.length; i++) {
				const action = this.action_times[i];
				//console.log("voco action: ", action);
				
				try{
					if(action.slots.timer_type){
						const delta = action.moment - time;
						const item_id = "extension-photo-frame-voco-" + action.intent_message.sessionId;
						
						let action_el = document.getElementById(item_id);
						
						if(delta >= 0 && delta < 3600){
							
							if(this.debug){
								console.log("photo frame debug:  item_id, delta: ", item_id, delta);
							}
							
							if(action_el == null){
								if(this.debug){
									console.log("photo frame debug: creating new voco timer DOM element");
								}
								action_el = document.createElement('div');
								action_el.classList.add('extension-photo-frame-voco-item');
								action_el.classList.add('extension-photo-frame-voco-item-' + action.slots.timer_type);
								action_el.id = item_id;
								action_el.innerHTML =  '<img src="/extensions/photo-frame/images/' + action.slots.timer_type + '.svg"/><div class="extension-photo-frame-voco-item-time"><span class="extension-photo-frame-voco-item-minutes"></span><span class="extension-photo-frame-voco-item-seconds"></span></div>';
								action_el.innerHTML += '<div class="extension-photo-frame-voco-item-info"><h4 class="extension-photo-frame-voco-item-title">' + action.slots.sentence + '</h4></div>';
								voco_overlay_el.appendChild(action_el);
							}
							else{
								if(this.debug){
									console.log("photo frame debug: voco action_el already existed");
								}
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
						else{
							if(action_el){
								if(this.debug){
									console.log("photo frame debug: removing outdated Voco action item from DOM");
								}
								action_el.remove();
							}
						}
					}
					else{
						if(this.debug){
							//console.log("photo frame: voco timer had no timer type (likely a delayed switching of a device): ", action);
						}
					}
				}
				catch(err){
					if(this.debug){
						console.error("photo frame debug: caught error parsing Voco timer: ", err);
					}
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
					if(this.debug){
						console.error("photo-frame debug: show_list: no photo file list to show");
					}
					return;
				}
			}
			if(this.busy_selecting_safe_photos == true){
				if(this.debug){
					console.warn("aborting thumbnal redraw while busy_selecting_safe_photos is true");
				}
				return
			}
			
            //console.log("Updating photo list")
            const photo_list = this.view.querySelector('#extension-photo-frame-photos-list');
            const picture_holder = this.view.querySelector('#extension-photo-frame-picture-holder');
            const overview = this.view.querySelector('#extension-photo-frame-overview');
            const picture1 = this.view.querySelector('#extension-photo-frame-picture1');
            const picture2 = this.view.querySelector('#extension-photo-frame-picture2');

            file_list.sort();

            this.filenames = file_list;
			this.ensure_privacy_mode();
            //this.filenames = file_list;

			if(photo_list == null){
				//console.warn("photo-frame: show_list: photo_list element does not exist (yet). aborting.");
				return;
			}

            photo_list.innerHTML = "";

			this.show_list_called = true; // inital calling of show_list is delayed a bit to avoid network congestion from loading all pictures at once. But that call is ignored if the user has already chosen to open the photo overview.
			

			var photo_counter = 0;
            for (var key in file_list) {
				
				const photo_filename = file_list[key];
				const photo_count = photo_counter;
                let node = document.createElement("li"); // Create a <li> node
                node.setAttribute("class", "extension-photo-frame-list-item");
                node.setAttribute("data-filename", file_list[key]);

				if(this.safe_photos.indexOf(photo_filename) != -1){
					node.classList.add('extension-photo-frame-list-item-privacy-safe');
				}
				else{
					node.classList.add('extension-photo-frame-list-item-privacy-hidden');
				}

                var img_container_node = document.createElement("div"); // Create a <li> node
                img_container_node.setAttribute("class", "extension-photo-frame-list-thumbnail-container");

                let imgnode = document.createElement("img"); // Create a text node
                imgnode.setAttribute("class", "extension-photo-frame-list-thumbnail");
                imgnode.setAttribute("data-filename", photo_filename);
                imgnode.src = "/extensions/photo-frame/photos/" + photo_filename;
                imgnode.addEventListener('click', () => {
		            if(this.debug){
						console.log("photo frame debug: clicked on a thumbnail.  photo_filename, this.busy_selecting_safe_photos: ", photo_filename, this.busy_selecting_safe_photos);
					}
					if(this.busy_selecting_safe_photos){
						
						if(node.classList.contains('extension-photo-frame-list-item-privacy-safe')){
							node.classList.remove('extension-photo-frame-list-item-privacy-safe');
						}else{
							node.classList.add('extension-photo-frame-list-item-privacy-safe');
						}
						/*
						if(this.privacy_mode_enabled){
							if(node.classList.contains('extension-photo-frame-list-item-privacy-save')){
								node.classList.remove('extension-photo-frame-list-item-privacy-save');
							}else{
								node.classList.add('extension-photo-frame-list-item-privacy-save');
							}
						}
						else{
							if(node.classList.contains('extension-photo-frame-list-item-privacy-safe')){
								node.classList.remove('extension-photo-frame-list-item-privacy-safe');
							}else{
								node.classList.add('extension-photo-frame-list-item-privacy-safe');
							}
						}
						*/
						
					}
					else{
						this.current_photo_number = photo_count;
						//console.log("setting this.current_photo_number to: ", this.current_photo_number);
	                    this.show_file(event.target.getAttribute("data-filename")); //file_list[key]
	                    this.addClass(overview, "extension-photo-frame-hidden");
	                    this.removeClass(picture_holder, "extension-photo-frame-hidden");
						//console.log("clicked on image #: ", photo_count);
						this.get_list();
					}
                });
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
						event.target.parentElement.remove();
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
				console.log("photo frame debug: deleting file: ", filename);
			}
	        window.API.postJson(
                `/extensions/${this.id}/api/delete`, {
                    'action': 'delete',
                    'filename': filename
                }

            ).then((body) => {
                if(this.debug){
					console.log("photo frame debug: delete file response: ", body);
				}
                //this.show_list(body['data']);

            }).catch((e) => {
                console.error("Photo frame: caught error in delete response: ", e);
                this.flash_message("Could not delete file - connection error?");
            });

        }






		//
		//  FILE UPLOAD
		//

        upload_files(files) {
            if (files && files[0]) {

				let upload_progress_overlay_el = this.view.querySelector('#extension-photo-frame-upload-progress-container');
				if(upload_progress_overlay_el){
					
					upload_progress_overlay_el.innerHTML = '';
					let upload_indicator_container_el = document.createElement('div');
					upload_indicator_container_el.id="extension-photo-frame-upload-progress-inner";
					upload_indicator_container_el.innerHTML = '<h3>Uploading ' + files.length + ' pictures...</h3>';
					for (let b = 0; b < files.length; b++) {
						let upload_indicator_el = document.createElement('div');
						upload_indicator_el.classList.add('extension-photo-frame-upload-indicator-item');
						upload_indicator_container_el.appendChild(upload_indicator_el);
					}
					upload_progress_overlay_el.appendChild(upload_indicator_container_el);
					
					upload_progress_overlay_el.classList.remove('extension-photo-frame-hidden');
				}

				let progress_indicator_elements = document.querySelectorAll('.extension-photo-frame-upload-indicator-item');

				for (let i = 0; i < files.length; i++) {
					
									
					setTimeout(() => {
						
		                var filename = files[i]['name'].replace(/[^a-zA-Z0-9\.]/gi, '_').toLowerCase(); //.replace(/\s/g , "_");
		                var filetype = files[i].type;
		                //console.log("photo frame: upload: filename and type: ", filename, filetype);

						if(this.debug){
							console.log("photo frame debug: resizing: photo. Filename,filetype: ", filename, filetype);
						}

		                //console.log("this1: ", this);
		                var reader = new FileReader();

		                reader.addEventListener("load", (e) => {
							//console.log("reader e: ", e);
		                    var image = new Image();
							//console.log("reader.result: ", reader.result);
		                    image.src = reader.result;

		                    var this2 = this;

		                    image.onload = function() {
								if(this.debug){
									console.log("photo frame debug: offscreen image loaded. filetype, filename: ", filetype, filename);
									//console.log("photo-frame: offscreen image loaded. file_data: ", file_data);
									//console.log("photo-frame: offscreen image loaded. file_data.result: ", reader.result);
								}
								// file_data.result
								
								//const getBase64StringFromDataURL = (dataURL) =>
							    //dataURL.replace('data:', '').replace(/^.+,/, '');
								
								if(filetype != 'image/gif'){
									//console.warn("not a gif");
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
			                        //ctx.drawImage(this, 0, 0, imageWidth, imageHeight);
									ctx.drawImage(this, 0, 0, imageWidth, imageHeight);
									
									
									if(this.debug){
										console.log("photo frame debug: sending resized photo to backend: ", filename);
									}
			                        // The resized file ready for upload
			                        var finalFile = canvas.toDataURL(filetype);	
								}
								else{
									//console.warn("GIF!");
									if(this.debug){
										console.log("photo frame debug: sending raw GIF to backend: ", filename);
									}
									var finalFile = reader.result;	
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
										console.log("photo frame debug: saved photo. response body: ", body);
									}
									//if(i == files.length - 1){
									
									//}
		                            this2.show_list(body['data']);

									if(progress_indicator_elements[i]){
										//progress_indicator_elements[i].style.background = 'green';
										progress_indicator_elements[i].style.background = 'green url(/extensions/photo-frame/photos/' + filename + ') cover';
										
									}
									else{
										console.error("photo frame: progress indicator did not exist: ", i, progress_indicator_elements);
									}
								
									if(i == files.length  - 1){
										if(this.debug){
											console.log("photo frame debug: ALL UPLOADED");
										}
										setTimeout(() => {
											upload_progress_overlay_el.classList.add('extension-photo-frame-hidden');
										},1000);
										
									}

		                        }).catch((err) => {
		                            console.error("photo frame: error uploading image: ", err);
									if(progress_indicator_elements[i]){
										progress_indicator_elements[i].style.background = 'red';
									}
									setTimeout(() => {
										upload_progress_overlay_el.classList.add('extension-photo-frame-hidden');
									},2000);
		                            this.flash_message("Error, could not upload the image. Perhaps it's too big.");     
		                        });

		                    };

		                });

	                	reader.readAsDataURL( files[i] );
						
					},2000);
	                
				}
            }
        }

        
    	createDropzoneMethods() {
			//console.log("photo-frame: in createDropzoneMethods");
    	    let dropzone = this.view.querySelector('#extension-photo-frame-dropzone');

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
        
		
		
		
		ensure_thing_subscription(){
			if (this.debug) {
				console.log("photo frame debug: in ensure_thing_subscription.  this.subscribed_to_thing: ", this.subscribed_to_thing);
			}
			if (typeof this.subscribeToThingProperties == 'function' && this.subscribed_to_thing == false){
				//console.warn("\n\n\nthis.subscribeToThingProperties is available");
			
				API.getThings().then((things) => {
					//console.log('API: things: ', things);
					let found_the_thing = false;
					for(const index in things){
						//console.log("things[index]['href']: ", things[index]['href']);
						if(things[index]['href'] == '/things/photo-frame'){

							this.view.classList.add('extension-photo-frame-thing-available');
							
							this.subscribeToThingProperties('photo-frame', (message) => {
				
								if(this.debug){
									console.log("photo frame debug: handling snoop message.  message: ", message);
								}
								if(typeof message['night_mode'] == 'boolean'){
									this.night_mode = message['night_mode'];
									if(this.debug){
										console.log("photo frame debug: snooped night_mode message. this.night_mode is now: ", this.night_mode);
									}
				                	if(this.night_mode){
				                		document.body.classList.add('extension-photo-frame-night-mode');
				                	}
									else{
										document.body.classList.remove('extension-photo-frame-night-mode');
									}
								}
				
							});


							if(typeof this.subscribeToThingEvents === 'function'){
								this.subscribeToThingEvents('photo-frame', (message) => {
									if(typeof message['Next photo'] != 'undefined'){
										if(this.debug){
											console.log("photo frame debug: snoop message -> next photo");
										}
										this.next_picture();
									}
									else if(typeof message['Previous photo'] != 'undefined'){
										if(this.debug){
											console.log("photo frame debug: snoop message -> previous photo");
										}
										this.previous_picture();
									}
									else if(typeof message['Start screensaver'] != 'undefined'){
										if(this.debug){
											console.log("photo frame debug: snoop message -> Start screensaver now");
										}
										if(window.location.pathname == '/extensions/photo-frame'){
											window.last_activity_time = 0;
											this.do_screensaver_interval();
										}
									}
									else{
										if(this.debug){
											console.log("photo frame debug: handling snoop message: unexpected event message name");
										}
									}
								});
							}
							
						}
					}
				});
			}
		}
		
		
		// Not used. Created Snoop feature instead.
		start_websocket_client(){
			class WebSocketClient {
			  constructor(url, thing_id, options = {}) {
			    this.url = url;
			    this.options = {
			      reconnectInterval: 1000,
			      maxReconnectAttempts: 50,
			      heartbeatInterval: 30000,
			      ...options,
			    };
			    this.reconnectAttempts = 0;
			    this.messageQueue = [];
			    this.eventHandlers = {};
			    this.isConnected = false;
				this.connecting = false;
				this.thing_id = thing_id;

			    this.connect();
			  }

			  connect() {
				  this.reconnect_scheduled = false;
				  //console.error("websocket client: in connect().  this.thing_id: ", this.thing_id);
				  if(this.connecting == true){
					  console.error("websocket client: already busy connecting!  this.thing_id: ", this.thing_id);
					  return
				  }
				  this.connecting = true;
			    //console.log(`Connecting to ${this.url}...`);
			    try {
			      this.ws = new WebSocket(this.url);
			      this.setupEventHandlers();
			    } catch (error) {
			      console.error('dashboard: failed to create WebSocket:' + error);
			      this.scheduleReconnect();
			    }
			  }

			  setupEventHandlers() {
			    this.ws.onopen = (event) => {
			      //console.log('WebSocket connected');
			      this.isConnected = true;
				  this.connecting = false;
			      this.reconnectAttempts = 0;

			      // Send any queued messages
			      while (this.messageQueue.length > 0) {
			        const message = this.messageQueue.shift();
			        this.send(message);
			      }

			      // Start heartbeat
			      //this.startHeartbeat();

			      // Trigger custom open handlers
			      this.trigger('open', event);
			    };

			    this.ws.onmessage = (event) => {
			      //console.log('Websocket message received:', event.data);

			      // Try to parse JSON messages
			      let data = event.data;
			      try {
			        data = JSON.parse(event.data);
			      } catch (e) {
			        // Not JSON, use as-is
			      }

			      // Handle ping/pong for heartbeat
			      if (data.type === 'pong') {
			        this.lastPong = Date.now();
			        return;
			      }

			      // Trigger custom message handlers
			      this.trigger('message', data);

			      // Trigger typed message handlers
			      if (data.type) {
			        this.trigger(data.type, data);
			      }
			    };

			    this.ws.onerror = (error) => {
			      //console.error('dashboard: WebSocket error:', error);
			      this.trigger('error', error);
			    };

			    this.ws.onclose = (event) => {
			      //console.log(`dashboard: WebSocket closed: ${event.code} - ${event.reason}`, event);
			      this.isConnected = false;
				  this.connecting = false;
				  this.reconnect_scheduled = false;
			      this.stopHeartbeat();

				  event['thing_id'] = this.thing_id;
			      // Trigger custom close handlers
			      this.trigger('close', event);
				  /*
			      // Attempt to reconnect if not a normal closure
			      if (event.code !== 1000 && event.code !== 1001) {
					console.warn("websocket client: unexpected connection closure. scheduling reconnect.");
			        this.scheduleReconnect();
			      }
				  */
			    };
			  }

			  send(message) {
			    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			      const data =
			        typeof message === 'object' ? JSON.stringify(message) : message;
			      this.ws.send(data);
			    } else {
			      // Queue message if not connected
			      //console.error('dashboard: WebSocket not connected, queuing message');
			      this.messageQueue.push(message);
			    }
			  }

			  startHeartbeat() {
				  return
			    this.stopHeartbeat();
			    this.heartbeatTimer = setInterval(() => {
			      if (this.ws.readyState === WebSocket.OPEN) {
			        this.send({ type: 'ping', timestamp: Date.now() });

			        // Check for pong timeout
			        setTimeout(() => {
			          const timeSinceLastPong = Date.now() - (this.lastPong || 0);
			          if (timeSinceLastPong > this.options.heartbeatInterval * 2) {
			            console.log('Dashboard: websocket client: heartbeat timeout, reconnecting...');
			            this.ws.close();
			          }
			        }, 5000);
			      }
			    }, this.options.heartbeatInterval);
			  }

			  stopHeartbeat() {
				  return
			    if (this.heartbeatTimer) {
			      clearInterval(this.heartbeatTimer);
			      this.heartbeatTimer = null;
			    }
			  }

			  scheduleReconnect() {
				  if(this.connecting){
					  console.error("dashboard: websocket client: in scheduleReconnect, it seems the client is busy reconnecting? Aborting.");
					  return
				  }
				  if(this.reconnect_scheduled){
					  console.error("dashboard: websocket client: in scheduleReconnect, but a reconnect was already scheduled. Aborting.");
					  return
				  }
			    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
			      console.error('Dashboard: websocket max reconnection attempts reached (50)');
			      this.trigger('maxReconnectAttemptsReached');
			      return;
			    }

			    this.reconnectAttempts++;
			    const delay =
			      this.options.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);
				  console.warn(`Dashboard: websocket reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})...`);

			    setTimeout(() => {
					this.reconnect_scheduled = true;
			      this.connect();
			    }, delay);
			  }

			  on(event, handler) {
			    if (!this.eventHandlers[event]) {
			      this.eventHandlers[event] = [];
			    }
			    this.eventHandlers[event].push(handler);
			  }

			  off(event, handler) {
			    if (this.eventHandlers[event]) {
			      this.eventHandlers[event] = this.eventHandlers[event].filter(
			        (h) => h !== handler
			      );
			    }
			  }

			  trigger(event, data) {
			    if (this.eventHandlers[event]) {
			      this.eventHandlers[event].forEach((handler) => {
			        try {
			          handler(data);
			        } catch (error) {
			          //console.error(`Dashboard: Error in ${event} handler:`, error);
			        }
			      });
			    }
			  }

			  close() {
			    this.reconnectAttempts = this.options.maxReconnectAttempts;
			    this.stopHeartbeat();
			    if (this.ws) {
			      this.ws.close(1000, 'Dashboard: Client closing connection');
			    }
			  }
			}
			
			
			// Create instance
			
			const thing_id = 'photo-frame';
			
			let ws_protocol = 'ws';
			let port = 8080;
			if (location.protocol == 'https:') {
				port = 4443;
				ws_protocol = 'wss';
			}

			const thing_websocket_url = ws_protocol + '://' + window.location.hostname + ':' + port + '/things/' + thing_id + '?jwt=' + window.API.jwt; // /properties/temperature
			//console.log("generate_widget_content: creating new websocket client:  new thing_websocket_url: ", thing_websocket_url);
			
			this.websockets[ thing_id ] = new WebSocketClient(thing_websocket_url, thing_id);

			const client = this.websockets[ thing_id ];
			//console.log("new client: ", client);

			client.on('open', () => {
				if(this.debug){
					console.warn('\n\nphoto frame debug: a websocket is connected and ready.  thing_id: ' + client.thing_id + '\n\n');
				}
			});


			client.on('error', (error) => {
				if(this.debug){
					console.error('photo frame debug: websocket connection error:', error);
				}
				setTimeout(() => {
					client.scheduleReconnect();
				},2000);
			});

			client.on('close', (event) => {
			  if(this.debug){
				  console.warn('photo frame debug: WEBSOCKET CLOSED:', event.code, event.reason, event.thing_id);
			  }
			  if(event.code != 1000){
				  if(this.debug){
					  console.error("photo frame debug: websocket client close seems unexpected. Will attempt to re-open it in a few seconds");
				  }
				  setTimeout(() => {
					  client.scheduleReconnect();
				  },5000 + (Math.floor(Math.random() * 1000)));
			  }
			  else if(typeof event.thing_id == 'string'){
				  //console.log("websocket just closed, and it provided a thing_id so that it can potentially be re-opened: ", event.thing_id);
				  if(typeof this.websockets[event.thing_id] != 'undefined'){
					  if(this.debug){
						  console.log("photo frame debug: websocket was closed. thing_id: ", event.thing_id);
					  }
					  
					  try{
						  if(client.connecting == false && client.isConnected == false){
							  if(this.debug){
								  console.log("photo frame debug: CALLING Websocket CLIENT.CONNECT after it was closed");
							  }
							  client.connect();
						  }
						  else{
							  if(this.debug){
								  console.error("\nphoto frame debug:  END.\n\nre-opening websocket after close: something beat me to it?");
							  }
						  }
						  
					  }
					  catch(err){
						  if(this.debug){
							  console.error("photo frame debug: caught error trying to re-connect to websocket client: ", err);
						  }
					  }
					  
				  }
				  else{
					  if(this.debug){
						  console.error("photo frame debug: websocket that just closed no longer exists in this.websockets? ", event.thing_id, this.websockets);
					  }
				  }
				  //console.warn("OK, received thing_id from websocket client that finished closing: ", event.thing_id);
			  }
			});
			

			client.on('message', (data) => {
				if(this.debug){
					console.log('\n\n\nphoto frame debug: websocket message received:', JSON.stringify(data,null,2));
				}
				
				
				if(window.location.pathname == '/extensions/photo-frame' && this.view && typeof data['id'] == 'string' && data['id'] == thing_id && typeof data['messageType'] == 'string' && typeof data['data'] != 'undefined'){ // && data['messageType'] == 'propertyStatus'
					//console.log(" -- the websocket message contains a propertyStatus");

					if(this.debug){
						console.log("photo frame debug: as expected, received a websocket message for this thing: " + thing_id + " with keys: " + JSON.stringify(Object.keys(data['data'])));
					}
					/*
					for (let [property_id, property_value] of Object.entries( data['data'] )) {
						
					}
					*/
				}
				
			});
			
			//console.log("connect_websockets: this.websockets is now: ", this.websockets);
			
			if(this.websocket_before_unload_added == false){
				this.websocket_before_unload_added = true;
				window.addEventListener("beforeunload", (event) => {
					this.close_all_websockets();
				});
			}
			
		}
		
		
		close_all_websockets(){
			for (const [websocket_thing_id, websocket_client] of Object.entries( this.websockets )) {
				if(websocket_client){
					websocket_client.close(websocket_thing_id);
				}
			}
			
		}
		
		
		
		
		
		
		
		
		
		
		
		
		
		
		
		
		
		
		play_a_sound(){
			let sound = new Audio('/extensions/photo-frame/audio/notification.mp3'); 
			sound.play();
		}
		
		
		
		flash_message(message){
			if(typeof message == 'string' && message.length){
				let flash_message_el = document.getElementById('extension-candleappstore-flash-message-container');
				if(!flash_message_el){
					flash_message_el = document.createElement('div');
					flash_message_el.setAttribute('id','extension-candleappstore-flash-message-container');
					document.body.appendChild(flash_message_el);
				}
				if(flash_message_el){
					flash_message_el.innerHTML = '<h3>' + message + '</h3>';
					setTimeout(() => {
						flash_message_el.innerHTML = '';
					},3000);
				}
				else{
					alert(message);
				}
			}
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
