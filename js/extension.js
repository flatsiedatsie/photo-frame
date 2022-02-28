(function() {
	class PhotoFrame extends window.Extension {
	    constructor() {
	      	super('photo-frame');
			//console.log("Adding Photo frame to menu");
	      	this.addMenuEntry('Photo Frame');

            
            this.kiosk = false;
            if(document.getElementById('virtualKeyboardChromeExtension') != null){
                document.body.classList.add('kiosk');
                this.kiosk = true;
            }

            this.debug = false;

	      	this.content = '';
            
            // Screensaver
            this.screensaver_delay = 60;
            this.showing_screensaver = false;
            this.previous_last_activity_time = 0;
			this.screensaver_path = 'photo-frame';
            this.screensaver_ignore_click = false;
            
            

            // Printer
            this.printer_available = false;
            this.last_activity_time = new Date().getTime()
            
            
            // Photo frame
            this.filenames = [];
			this.interval = 30;
			this.fit_to_screen = "mix";
			this.clock = false;
            this.show_date = false;
            this.seconds_counter = 0; // if it reaches the interval value, then it will show another picture.
			this.current_picture = 1; // two pictures swap places: picture1 and picture2. This is for a smooth transition effect
            
            
			fetch(`/extensions/${this.id}/views/content.html`)
			.then((res) => res.text())
			.then((text) => {
				this.content = text;
				if( document.location.href.endsWith("photo-frame") ){
					this.show();
				}
			})
			.catch((e) => console.error('Failed to fetch content:', e));
            
            
            // Check if screensaver should be active
	        window.API.postJson(
	          `/extensions/photo-frame/api/list`,
	  				{'init':1}

	        ).then((body) => {
                if(typeof body.settings.screensaver_delay != 'undefined'){
                    this.screensaver_delay = body.settings.screensaver_delay;
                    if(body.settings.screensaver_delay > 1){
                        console.log('calling start screensaver listeners');
                        this.start_screensaver_listeners();
                    }
                    
                }
                
                this.debug = body.debug;
                if(this.debug){
    	  			console.log("photo frame: init returned:");
                    console.log(body);
                }
                
                if( typeof body.printer != 'undefined'){
                    this.printer_available = body.printer;
                }
                
	        }).catch((e) => {
	  			console.log("Photo frame: error in init function: ", e);
	        });
      
            
	    }
		
        
        
        
        
//
//  SCREENSAVER
//

        start_screensaver_listeners() {
            
            //this.screensaver_interval = setInterval(myCallback, 500);
            this.screensaver_interval = setInterval( () => {
                
                const current_time = new Date().getTime();
                const delta = current_time - this.last_activity_time;
                //console.log('delta: ', delta);
                if(delta > this.screensaver_delay * 1000){
                    if(this.showing_screensaver == false){
                        this.screensaver_ignore_click = true;
                        window.setTimeout(() => {
                            this.screensaver_ignore_click = false;
                        });
                        //console.log('should start screensaver');
                        this.screensaver_path = window.location.pathname;
                        //console.log("remembered path: ", this.screensaver_path);
                        this.showing_screensaver = true;
            			const photo_frame_menu_button = document.getElementById("extension-photo-frame-menu-item");
                        if(photo_frame_menu_button != null){
                            photo_frame_menu_button.click();
                        }
                    }
                }
                else{
                    if(this.showing_screensaver == true){
                        //console.log("resetting path: ", this.screensaver_path);
                        
                        var short_path = "photo-frame";
                        if(this.screensaver_path.startsWith('/extensions')){
                            var short_path = this.screensaver_path.split('/')[2]
                        }
                        else{
                            this.screensaver_path.split('/')[1]
                        }
                        
                        
                        var spotted_in_menu = false;
                        const addon_name_css = short_path.replace(/_/g, "-");
                        const menu_elements = document.querySelectorAll('#main-menu li a');
                        var id_to_click_on = "photo-frame";
                        menu_elements.forEach(element => {
                            var link_id = element.getAttribute('id');
                            const short_link_id = link_id.replace("-menu-item", "");
                            if(short_link_id.endsWith(addon_name_css)){
                                spotted_in_menu = true;
                                id_to_click_on = link_id;
                            }
                        });
                        
                        if(spotted_in_menu == false){
                            //window.location.pathname = this.screensaver_path;
                        }
                        else{
                			const menu_link = document.getElementById(id_to_click_on);
                			menu_link.click(); //dispatchEvent('click');
                        }
                        
                        
                    }
                    this.showing_screensaver = false;
                }
                
                if(delta < 1500){
                    if(document.body.classList.contains('developer')){
                        const indicator = document.getElementById("extension-photo-frame-screensaver-indicator");
                        if(indicator != null){
                            indicator.parentNode.removeChild(indicator);
                        }
                        let indicator_element = document.createElement("div");
                        indicator_element.setAttribute('id','extension-photo-frame-screensaver-indicator');
                        document.body.append(indicator_element);
                    }
                }
                
            },1000);
            
            
            
            //console.log('starting activity timeout check for screensaver. Delay seconds: ', this.screensaver_delay);

            // Mouse
            window.addEventListener('mousemove', () => {
                this.last_activity_time = new Date().getTime();
            },{ passive: true });
            window.addEventListener('mousedown', () => {
                this.last_activity_time = new Date().getTime();
            },{ passive: true });
            window.addEventListener('click', () => {
                if(this.screensaver_ignore_click){
                    console.log('ignoring click');
                }
                else{
                    this.last_activity_time = new Date().getTime();
                }
                
            },{ passive: true });
            
            // Touch
            window.addEventListener('touchstart', () => {
                this.last_activity_time = new Date().getTime();
            },{ passive: true });
            window.addEventListener('touchmove', () => {
                this.last_activity_time = new Date().getTime();
            },{ passive: true });
            
            // Scroll
            window.addEventListener('scroll', () => {
                this.last_activity_time = new Date().getTime();
            }, true);
            
             
        }
        
        
		
		
		change_picture(){
			
			if( this.filenames.length > 0 ){
				var random_file = this.filenames[Math.floor(Math.random() * this.filenames.length)];
				//console.log("new picture: " + random_file);
				this.show_file(random_file);
			}
		}


		create_thing_list(body){
			//console.log("Creating main thing list");
			
			const pre = document.getElementById('extension-photo-frame-response-data');
			const thing_list = document.getElementById('extension-photo-frame-thing-list');

			for (var key in body['data']) {

				var dataline = JSON.parse(body['data'][key]['name']);
				var node = document.createElement("LI");
			}
		}
		
	
		
		
		
		// HELPER METHODS
		
		hasClass(ele,cls) {
			return !!ele.className.match(new RegExp('(\\s|^)'+cls+'(\\s|$)'));
		}

		addClass(ele,cls) {
			if (!this.hasClass(ele,cls)) ele.className += " "+cls;
		}

		removeClass(ele,cls) {
			if (this.hasClass(ele,cls)) {
		    	var reg = new RegExp('(\\s|^)'+cls+'(\\s|$)');
		    	ele.className=ele.className.replace(reg,' ');
		  	}
		}
		
		thing_list_click(the_target){
			const pre = document.getElementById('extension-photo-frame-response-data');
    	}



        show() {
            //console.log("in photo frame show");
    		if(this.content == ''){
    			return;
    		}
    		else{
    			this.view.innerHTML = this.content;
    		}	
	  
    		
    		const pre = document.getElementById('extension-photo-frame-response-data');
    		const thing_list = document.getElementById('extension-photo-frame-thing-list');

    		//pre.innerText = "";
		
		
    		if( this.kiosk ) {
    			//console.log("fullscreen");
                document.getElementById('extension-photo-frame-photos-file-selector').style.display = 'none';
    			document.getElementById('extension-photo-frame-photos-file-selector').outerHTML = "";
    			//document.getElementById('extension-photo-frame-dropzone').outerHTML = "";
			
    		}
    		else{
    			//console.log("Attaching file listeners");
    			document.getElementById("extension-photo-frame-photos-file-selector").addEventListener('change', () => {
    				var filesSelected = document.getElementById("extension-photo-frame-photos-file-selector").files;
    				this.upload_files(filesSelected);
    			});
			
    			//this.createDropzoneMethods(); //  disabled, as files could be too big. For now users can just upload an image one at a time.
    		}
			
			
            
            if(this.printer_available){
                if(document.getElementById('extension-photo-frame-content') != null){
                    document.getElementById('extension-photo-frame-content').classList.add('extension-photo-frame-printer-available');
                }
                
            }
            

    		// EVENT LISTENERS

    		document.getElementById("extension-photo-frame-more-button-container").addEventListener('click', () => {
    			event.stopImmediatePropagation();
    			const picture_holder = document.getElementById('extension-photo-frame-picture-holder');
    			const overview = document.getElementById('extension-photo-frame-overview');
    			this.removeClass(overview,"extension-photo-frame-hidden");
    			this.addClass(picture_holder,"extension-photo-frame-hidden");
    		});
			
			
    		document.getElementById("extension-photo-frame-picture-holder").addEventListener('click', () => {
                if(this.showing_screensaver == false){
        			var menu_button = document.getElementById("menu-button");
        			menu_button.click();//dispatchEvent('click');
                }
                this.last_activity_time = new Date().getTime();
    			
    		});
			
            /*
    		document.getElementById("extension-photo-frame-back-button").addEventListener('click', () => {
    			const picture_holder = document.getElementById('extension-photo-frame-picture-holder');
    			const overview = document.getElementById('extension-photo-frame-overview');
    			this.addClass(overview,"extension-photo-frame-hidden");
    			this.removeClass(picture_holder,"extension-photo-frame-hidden");
    		});
            */
            

    		// Get list of photos (as well as other variables)
			
          	window.API.postJson(
            	`/extensions/${this.id}/api/list`,
    				{'init':1}
			
    		).then((body) => {
                if(this.debug){
                    console.log("/list response: ", body);
                }
            
				this.settings = body['settings'];
				this.interval = body['settings']['interval'];
				this.fit_to_screen = body['settings']['fit_to_screen'];
				this.show_clock = body['settings']['show_clock'];
                this.show_date = body['settings']['show_date'];
	
        		if( this.fit_to_screen == 'contain' ){
        			//console.log("Contain the image");
        			document.getElementById('extension-photo-frame-picture1').style.backgroundSize = "contain";
                    document.getElementById('extension-photo-frame-picture2').style.backgroundSize = "contain";
        		}
        		else if( this.fit_to_screen == 'cover' ){
        			//console.log("Do not contain the image");
        			document.getElementById('extension-photo-frame-picture1').style.backgroundSize = "cover";
                    document.getElementById('extension-photo-frame-picture2').style.backgroundSize = "cover";
        		}
                else{
        			document.getElementById('extension-photo-frame-picture1').style.backgroundSize = "cover";
                    document.getElementById('extension-photo-frame-picture2').style.backgroundSize = "contain";
                }
	
	
        		// Interval
        		this.photo_interval = setInterval(() => {
        
                    if(this.seconds_counter > this.interval){
                        this.change_picture();
                    }
                    else{
                        this.seconds_counter++;
                    }
        
                    //console.log(this.seconds_counter);

        		}, 1000);
	
        		if( body['data'].length > 0 ){
		
        			this.filenames = body['data'];
        			this.show_list(body['data']);
        			this.change_picture();

        		}
	
                if(this.show_date){
                    document.getElementById('extension-photo-frame-date').classList.add('show');
                }
                
                
        		if(this.show_clock){
                    document.getElementById('extension-photo-frame-clock').classList.add('show');
                }
                
                this.update_clock();
                
                if(this.show_clock || this.show_date){
                    
        			// Start clock
        			clearInterval(window.photo_frame_clock_interval); 
		
        			window.photo_frame_clock_interval = setInterval(() => {
        				//console.log("Clock tick");
			
        				this.update_clock();

        			}, 1000);
        		}

          	}).catch((e) => {
            	//pre.innerText = e.toString();
    			console.log("Photo frame: error in show list function: ", e);
          	});
	  
        } // and of show function
		
		
        
    	hide(){
		
    		try {
    			window.clearInterval(this.photo_interval);
    		}
    		catch (e) {
    			//console.log("Could not clear photo rotation interval");
    			//console.log(e); //logMyErrors(e); // pass exception object to error handler
    		}
		
    		try {
    			window.clearInterval(this.wake_interval);
    		}
    		catch (e) {
    			//console.log("Could not clear keep awake interval");
    			//console.log(e); //logMyErrors(e); // pass exception object to error handler
    		}
    	}



        update_clock(){
			var hour_padding = "";
			var minute_padding = "";

			var date = new Date(); /* creating object of Date class */
            
            if(this.show_clock){
            
                var hour = date.getHours();
				var min = date.getMinutes();
				//const sec = date.getSeconds();
                
				if( min < 10 ){
					minute_padding = "0";
				}
				if( hour < 10 ){
					hour_padding = "0";
				}

				document.getElementById('extension-photo-frame-clock').innerText = hour + ":" + minute_padding + min;
                
            }
            
            
            if(this.show_date){
            
                //this.show_date = true;
            
                // Day name
                const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                document.getElementById('extension-photo-frame-date-day').innerText = days[date.getDay()];
            
                // Day of month
                document.getElementById('extension-photo-frame-date-date').innerText = date.getDate();
            
                // Month name
                const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                document.getElementById('extension-photo-frame-date-month').innerText  = months[date.getMonth()];
            
            }
        }



    	//
    	//  SHOW LIST
    	//
		

        show_list(file_list){
    		//console.log("Updating photo list")
    		const pre = document.getElementById('extension-photo-frame-response-data');
    	  	const photo_list = document.getElementById('extension-photo-frame-photos-list');
    		const picture_holder = document.getElementById('extension-photo-frame-picture-holder');
    		const overview = document.getElementById('extension-photo-frame-overview');
    		const picture1 = document.getElementById('extension-photo-frame-picture1');
            const picture2 = document.getElementById('extension-photo-frame-picture2');
        
    		file_list.sort();
		
    		this.filenames = file_list;
    		//this.filenames = file_list;
		
    		photo_list.innerHTML = "";
		
    		for (var key in file_list) {
			
    			var node = document.createElement("LI");                 					// Create a <li> node
    			node.setAttribute("class", "extension-photo-frame-list-item" ); 
    			node.setAttribute("data-filename", file_list[key] );
			
    			var img_container_node = document.createElement("div");                 					// Create a <li> node
    			img_container_node.setAttribute("class", "extension-photo-frame-list-thumbnail-container" ); 
			
    			var imgnode = document.createElement("IMG");         // Create a text node
    			imgnode.setAttribute("class","extension-photo-frame-list-thumbnail");
    			imgnode.setAttribute("data-filename",file_list[key]);
    			imgnode.src = "/extensions/photo-frame/photos/" + file_list[key];
    			imgnode.onclick = (event) => { 
    				this.show_file( event.target.getAttribute("data-filename") ); //file_list[key]
    				this.addClass(overview,"extension-photo-frame-hidden");
    				this.removeClass(picture_holder,"extension-photo-frame-hidden");
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
                delete_button.setAttribute("class","extension-photo-frame-thumbnail-delete-button");
                delete_button.setAttribute("data-filename", file_list[key]);
            
    			//delete_button.onclick = () => { 
                delete_button.addEventListener('click', (event) => {
    				//this.delete_file( file_list[key] );
    				//console.log(this.getAttribute("data-filename"));
                    if( confirm("Are you sure?")){
                        this.delete_file( event.target.getAttribute("data-filename") );
                    }
				
    			});
                node.appendChild(delete_button); 
                
                
                // Add print button
                var print_button = document.createElement("div");
                print_button.setAttribute("class","extension-photo-frame-thumbnail-print-button");
                print_button.setAttribute("data-filename", file_list[key]);
            
    			//print_button.onclick = () => { 
                print_button.addEventListener('click', (event) => {
    				//this.print_file( file_list[key] );
    				//console.log(this.getAttribute("data-filename"));
                    if( confirm("Are you sure you want to print this picture?")){
                        this.print_file( event.target.getAttribute("data-filename") );
                    }
				
    			});
                node.appendChild(print_button); 
            
                
                
            
            
    			photo_list.appendChild(node);
    		}
    		//pre.innerText = "";
    	}

		
	
    	delete_file(filename){
            //console.log("Deleting file:" + filename);
			
        	const pre = document.getElementById('extension-photo-frame-response-data');
        	const photo_list = document.getElementById('extension-photo-frame-photo-list');
		
            window.API.postJson(
                `/extensions/${this.id}/api/delete`,
                {'action':'delete', 'filename':filename}
				
              ).then((body) => { 
                  //console.log(body);
                  this.show_list(body['data']);

              }).catch((e) => {
        	      console.log("Photo frame: error in delete response: ", e);
                  alert("Could not delete file - connection error?");
              });
    
        }
        
        
    	print_file(filename){
            console.log("Printing file:" + filename);
			
        	const pre = document.getElementById('extension-photo-frame-response-data');
        	const photo_list = document.getElementById('extension-photo-frame-photo-list');
		
            window.API.postJson(
                `/extensions/${this.id}/api/print`,
                {'action':'print', 'filename':filename}
				
              ).then((body) => { 
                  console.log('file sent to printer');

              }).catch((e) => {
        	      console.log("Photo frame: error in print response: ", e);
                  alert("Could not print file - connection error?");
              });
    
        }
        
        
		
	
    	show_file(filename){
    		const pre = document.getElementById('extension-photo-frame-response-data');
    		const picture_holder = document.getElementById('extension-photo-frame-picture-holder');
            const picture1 = document.getElementById('extension-photo-frame-picture1');
            const picture2 = document.getElementById('extension-photo-frame-picture2');
    		const overview = document.getElementById('extension-photo-frame-overview');
    		//console.log("showing photo: " + filename);
        
            if(this.current_picture == 1){
                this.current_picture = 2;
                picture2.style.backgroundImage="url(/extensions/photo-frame/photos/" + filename + ")";
                picture2.classList.add('extension-photo-frame-current-picture');
                setTimeout(() => {
                    picture1.classList.remove('extension-photo-frame-current-picture');
                }, 500);
            
            }
            else{
                // Switching from picture 2 to back to picture 1
                this.current_picture = 1;
                picture1.style.backgroundImage="url(/extensions/photo-frame/photos/" + filename + ")";
                picture1.classList.add('extension-photo-frame-current-picture');
                setTimeout(() => {
                    picture2.classList.remove('extension-photo-frame-current-picture');
                }, 500);
            }
		
            this.seconds_counter = 0;
    	}


    	upload_files(files){
    		if (files && files[0]) {
			
    			var filename = files[0]['name'].replace(/[^a-zA-Z0-9\.]/gi, '_').toLowerCase(); //.replace(/\s/g , "_");
                var filetype = files[0].type;
                //console.log("filename and type: ", filename, filetype);
            
                //console.log("this1: ", this);
    		    var reader = new FileReader();

    		    reader.addEventListener("load", (e) => {
			    
                    var image = new Image();
                        image.src = reader.result;


                    var this2 = this;
                    
                    image.onload = function(){
                        var maxWidth = 1270,
                            maxHeight = 1270,
                            imageWidth = image.width,
                            imageHeight = image.height;

                            if (imageWidth > imageHeight) {
                                if (imageWidth > maxWidth) {
                                    imageHeight *= maxWidth / imageWidth;
                                    imageWidth = maxWidth;
                                }
                            }
                            else {
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
                  
                  
                            window.API.postJson(
              		        	`/extensions/photo-frame/api/save`,
                                {'action':'upload', 'filename':filename, 'filedata': finalFile, 'parts_total':1, 'parts_current':1} //e.target.result

              			      ).then((body) => {
                                    //console.log("saved");
                                    this2.show_list(body['data']);

              			      }).catch((e) => {
              					    console.log("Error uploading image: ", e);
                                    //alert("Error, could not upload the image. Perhaps it's too big.");     
              			      });
                              
                    };
			
    		    }); 

    		    reader.readAsDataURL( files[0] );
    	  	}
    	}



        /*
    	createDropzoneMethods() {
    	    let dropzone = document.getElementById("extension-photo-frame-dropzone");
    			const pre = document.getElementById('extension-photo-frame-response-data');

    			var this = this;
    	    dropzone.ondragover = function() {
    	        this.className = "extension-photo-frame-dragover";
    	        return false;
    	    }

    	    dropzone.ondragleave = function() {
    	        this.className = "";
    	        return false;
    	    }

    	    dropzone.ondrop = function(e) {
    	        // Stop browser from simply opening that was just dropped
    	        e.preventDefault();  
    	        // Restore original dropzone appearance
    	        this.className = "";
    			var files = e.dataTransfer.files;
    			this.upload_files(files);
    	    }    
    	}
        */
	
	
    }

    new PhotoFrame();
	
})();
