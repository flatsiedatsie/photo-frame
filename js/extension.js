(function() {
	class PhotoFrame extends window.Extension {
	    constructor() {
	      	super('photo-frame');
			//console.log("Adding Photo frame to menu");
	      	this.addMenuEntry('Photo Frame');

	      	this.content = '';
			//var filenames = [];
			this.filenames = [];
			window.photo_frame_filenames = [];


			this.interval = 30;
			this.contain = true;
			this.clock = false;
			
			fetch(`/extensions/${this.id}/views/content.html`)
			.then((res) => res.text())
			.then((text) => {
				this.content = text;
			})
			.catch((e) => console.error('Failed to fetch content:', e));
			
	    }
		
		
		
		change_picture(){
			
			if( window.photo_frame_filenames.length > 0 ){
				var random_file = window.photo_frame_filenames[Math.floor(Math.random() * window.photo_frame_filenames.length)];
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
				
				var this_object = this;
				
				var node = document.createElement("LI");
			}
			pre.innerText = "";
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
    	this.view.innerHTML = this.content;
	  
		const clock_element = document.getElementById('extension-photo-frame-clock');
		const pre = document.getElementById('extension-photo-frame-response-data');
		const thing_list = document.getElementById('extension-photo-frame-thing-list');

		pre.innerText = "";
		
		var this_object = this;
		
		if( window.innerHeight == screen.height) {
			//console.log("fullscreen");
			document.getElementById('extension-photo-frame-photos-file-selector').outerHTML = "";
			document.getElementById('extension-photo-frame-dropzone').outerHTML = "";
			
		}
		else{
			//console.log("Attaching file listeners");
			document.getElementById("extension-photo-frame-photos-file-selector").addEventListener('change', () => {
				var filesSelected = document.getElementById("extension-photo-frame-photos-file-selector").files;
				this.upload_files(filesSelected);
			});
			
			this.createDropzoneMethods();
		}
			
			

		// EVENT LISTENERS

		document.getElementById("extension-photo-frame-picture-exit").addEventListener('click', () => {
			event.stopImmediatePropagation();
			const picture = document.getElementById('extension-photo-frame-picture-holder');
			const overview = document.getElementById('extension-photo-frame-overview');
			this.removeClass(overview,"extension-photo-frame-hidden");
			this.addClass(picture,"extension-photo-frame-hidden");
		});
			
			
		document.getElementById("extension-photo-frame-picture-holder").addEventListener('click', () => {
			var menu_button = document.getElementById("menu-button");
			menu_button.click();//dispatchEvent('click');
		});
			

		// Get list of photos (as well as other variables)
			
      	window.API.postJson(
        	`/extensions/${this.id}/api/list`,
				{'init':1}
			
		).then((body) => {
			
				this_object.settings = body['settings'];
				this_object.interval = body['settings']['interval'];
				this_object.contain = body['settings']['contain'];
				this_object.clock = body['settings']['clock'];
		
		if( this_object.contain ){
			//console.log("Contain the image");
			document.getElementById('extension-photo-frame-picture-holder').style.backgroundSize = "contain";
		}
		else{
			//console.log("Do not contain the image");
			document.getElementById('extension-photo-frame-picture-holder').style.backgroundSize = "cover";
		}
		
		
		// Interval
		this_object.photo_interval = setInterval(function () {
				//console.log("intervallo");
				this_object.change_picture();

		}, this_object.interval * 1000);
		
		if( body['data'].length > 0 ){
			
			this_object.filenames = body['data'];
			this_object.show_list(body['data']);
			this_object.change_picture();

		}
		

		if(this_object.clock){
			// Start clock
			clearInterval(window.photo_frame_clock_interval); 
			
			window.photo_frame_clock_interval = setInterval(function () {
				//console.log("Clock tick");
				
				var hour_padding = "";
				var minute_padding = "";
				
				var date = new Date(); /* creating object of Date class */
				var hour = date.getHours();
				var min = date.getMinutes();
				var sec = date.getSeconds();
	
	
				if( min < 10 ){
					minute_padding = "0";
				}
				if( hour < 10 ){
					hour_padding = "0";
				}
				
				clock_element.innerText = hour + ":" + minute_padding + min;
	
			}, 1000);
		}
				
				
				


      	}).catch((e) => {
        	//pre.innerText = e.toString();
			console.log("Photo frame: error in show list function: " + e.toString());
      	});
	  
	  
	  
	  
	  	// Set interval to keep the screen awake
		this_object.wake_interval = setInterval(function () {
			//console.log("Sending wake command");
	        window.API.postJson(
	          `/extensions/photo-frame/api/wake`,
	  				{'init':1}

	        ).then((body) => {
	  			//console.log("wake returned:");
	  			//console.log(body);
	        }).catch((e) => {
	        	//pre.innerText = e.toString();
	  			console.log("Photo frame: error in keep awake function: " + e.toString());
	        });
			
		}, 30000);
	  
    } // and of show function
		
		
	hide(){
		
		try {
			window.clearInterval(this.photo_interval);
		}
		catch (e) {
			console.log("Could not clear photo rotation interval");
			console.log(e); //logMyErrors(e); // pass exception object to error handler
		}
		
		try {
			window.clearInterval(this.wake_interval);
		}
		catch (e) {
			console.log("Could not clear keep awake interval");
			console.log(e); //logMyErrors(e); // pass exception object to error handler
		}
	}




	//
	//  SHOW LIST
	//
		

    show_list(file_list){
		//console.log("Updating photo list")
		const pre = document.getElementById('extension-photo-frame-response-data');
	  	const photo_list = document.getElementById('extension-photo-frame-photos-list');
		const picture = document.getElementById('extension-photo-frame-picture-holder');
		const overview = document.getElementById('extension-photo-frame-overview');
		
		file_list.sort();
		
		window.photo_frame_filenames = file_list;
		//this.filenames = file_list;
		
		photo_list.innerHTML = "";
		
		for (var key in file_list) {
			
			var this_object = this;
			
			var node = document.createElement("LI");                 					// Create a <li> node
			node.setAttribute("class", "extension-photo-frame-list-item" ); 
			node.setAttribute("data-filename", file_list[key] );
			
			var img_container_node = document.createElement("div");                 					// Create a <li> node
			img_container_node.setAttribute("class", "extension-photo-frame-list-thumbnail-container" ); 
			
			
			var imgnode = document.createElement("IMG");         // Create a text node
			imgnode.setAttribute("class","extension-photo-frame-list-thumbnail");
			imgnode.setAttribute("data-filename",file_list[key]);
			imgnode.src = "/extensions/photo-frame/photos/" + file_list[key];
			imgnode.onclick = function() { 
				this_object.show_file( this.getAttribute("data-filename") ); //file_list[key]
				this_object.addClass(overview,"extension-photo-frame-hidden");
				this_object.removeClass(picture,"extension-photo-frame-hidden");
			};
			//console.log(imgnode);
			img_container_node.appendChild(imgnode); 
			node.appendChild(img_container_node); 
			
			var textnode = document.createElement("span"); 
			textnode.setAttribute("class","extension-photo-frame-deletable_item");
			textnode.setAttribute("data-filename", file_list[key]);
			//console.log(textnode);
			textnode.innerHTML = file_list[key];         // Create a text node
			textnode.onclick = function() { 
				//this_object.delete_file( file_list[key] );
				//console.log(this.getAttribute("data-filename"));
				this_object.delete_file( this.getAttribute("data-filename") );
			};
			node.appendChild(textnode); 
			
			photo_list.appendChild(node);
		}
		pre.innerText = "";
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
				console.log("Photo frame: error in delete response");
        pre.innerText = e.toString();
      });
    
    }
		
	
	show_file(filename){
		const pre = document.getElementById('extension-photo-frame-response-data');
		const picture = document.getElementById('extension-photo-frame-picture-holder');
		const overview = document.getElementById('extension-photo-frame-overview');
		//console.log("showing photo: " + filename);
		picture.style.backgroundImage="url(/extensions/photo-frame/photos/" + filename + ")";
	}


	upload_files(files){
		if (files && files[0]) {
			
			var filename = files[0]['name'];
				//console.log(filename);
		    var FR = new FileReader();

				var this_object = this;
		    FR.addEventListener("load", function(e) {
			
				var this_object2 = this_object;
				window.API.postJson(
		        	`/extensions/photo-frame/api/save`,
		        	{'action':'upload', 'filename':filename, 'filedata':e.target.result, 'parts_total':1, 'parts_current':1}

			      ).then((body) => {
			        this_object.show_list(body['data']);

			      }).catch((e) => {
					  document.getElementById('extension-photo-frame-response-data').innerText = e.toString();
			      });
			
		    }); 

		    FR.readAsDataURL( files[0] );
	  	}
	}



	createDropzoneMethods() {
	    let dropzone = document.getElementById("extension-photo-frame-dropzone");
			const pre = document.getElementById('extension-photo-frame-response-data');

			var this_object = this;
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
			this_object.upload_files(files);
	    }    
	}
	
	
}

  new PhotoFrame();
	
})();
