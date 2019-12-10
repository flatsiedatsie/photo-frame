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
				console.log("new picture: " + random_file);
				this.show_file(random_file);
			}
		}


		create_thing_list(body){
			//console.log("Creating main thing list");
			
			const pre = document.getElementById('extension-photo-frame-response-data');
			const thing_list = document.getElementById('extension-photo-frame-thing-list');

			for (var key in body['data']) {

				var dataline = JSON.parse(body['data'][key]['name']);
				//console.log(Object.keys(dataline));
				
				var this_object = this;
				//console.log(this_object);
				
				var node = document.createElement("LI");                 // Create a <li> node
				
				/*
				node.setAttribute("data-property-id", body['data'][key]['id']); 
				node.setAttribute("data-data-type", body['data'][key]['data_type']); 
				var human_readable_thing_title = dataline['thing'];
				if( human_readable_thing_title in this.thing_title_lookup_table ){
					human_readable_thing_title = this.thing_title_lookup_table[human_readable_thing_title];
				}
				var textnode = document.createTextNode(human_readable_thing_title + ' - ' + dataline['property']);         // Create a text node
				node.onclick = function() { this_object.thing_list_click(this) };
				node.appendChild(textnode); 
				thing_list.appendChild(node);
				*/
			}
			pre.innerText = "";
		}
		
	
		
		
		
		// HELPER METHODS
		
		hasClass(ele,cls) {
			//console.log(ele);
			//console.log(cls);
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
			
			// Update CSS
			/*
			var remove_click_css_list = document.querySelectorAll('#extension-photo-frame-thing-list > *');
			for (var i=0, max=remove_click_css_list.length; i < max; i++) {
				this.removeClass(remove_click_css_list[i],"clicked");
			}
			this.addClass(the_target,"clicked");
			
			var target_property_id = the_target.getAttribute('data-property-id');
			var target_data_type = the_target.getAttribute('data-data-type');
			//console.log(target_data_type);
			document.getElementById('extension-photo-frame-input-change-data-type').value = target_data_type; // Make sure this is always populated with the correct data type. Bit of a clumsy use of hidden fields, should improve later.
			//console.log(target_thing_id);
			
			// Get data for selected thing
      window.API.postJson(
        `/extensions/${this.id}/api/get_property_data`,
        {'property_id': target_property_id, 'data_type':target_data_type}
      ).then((body) => {
            this.display_thing_data(target_property_id, target_data_type, body['data']);
        		//pre.innerText = JSON.stringify(body, null, 2);
            //pre.innerText = body['state'];
      }).catch((e) => {
				console.log("Photo frame: error getting property data");
        pre.innerText = e.toString();
      });
			*/
    
    }



    show() {
      this.view.innerHTML = this.content;

			const pre = document.getElementById('extension-photo-frame-response-data');
	  	const thing_list = document.getElementById('extension-photo-frame-thing-list');

			pre.innerText = "";
			
			var this_object = this;
			//var photo_interval = setInterval(this.change_picture, 10000);
			
			this.createDropzoneMethods();
			
			
			//console.log(this._filenames);
			//console.log("this.filenames 1 = " + window.photo_frame_filenames);

			/*
			if(document.readyState === "complete") {
				console.log("Document ready");
			    createDropzoneMethods();
			} else {
			    document.addEventListener("DOMContentLoaded", createDropzoneMethods);
			}
			*/

			// TABS

			// Data sculptor
      /*
			tab_button_sculptor.addEventListener('click', () => {
				this.addClass(tab_button_sculptor,"extension-photo-frame-button-active");
				this.removeClass(tab_button_internal,"extension-photo-frame-button-active");
				
				this.addClass(tab_internal,"extension-photo-frame-hidden");
				this.removeClass(tab_sculptor,"extension-photo-frame-hidden");
      });

			// Internal logs tab
      tab_button_internal.addEventListener('click', () => {
				this.addClass(tab_button_internal,"extension-photo-frame-button-active");
				this.removeClass(tab_button_sculptor,"extension-photo-frame-button-active");
				
				this.addClass(tab_sculptor,"extension-photo-frame-hidden");
				this.removeClass(tab_internal,"extension-photo-frame-hidden");
				
	      window.API.postJson(
	        `/extensions/${this.id}/api/internal_logs`,
					{'action':'get' ,'filename':'all'}
        
	      ).then((body) => {
	      	//thing_list.innerText = body['data'];
	        this.show_internal_logs(body['data']);

	      }).catch((e) => {
	        //pre.innerText = e.toString();
					console.log("Photo frame: error in show function");
					console.log(e.toString());
	      });
				
      });
			*/

			// EVENT LISTENERS

			document.getElementById("extension-photo-frame-picture-exit").addEventListener('click', () => {
				event.stopImmediatePropagation();
				const picture = document.getElementById('extension-photo-frame-picture-holder');
				const overview = document.getElementById('extension-photo-frame-overview');
				this.removeClass(overview,"extension-photo-frame-hidden");
				this.addClass(picture,"extension-photo-frame-hidden");
      });
			
			document.getElementById("extension-photo-frame-photos-file-selector").addEventListener('change', () => {
					var filesSelected = document.getElementById("extension-photo-frame-photos-file-selector").files;
					this.upload_files(filesSelected);
      });
			
			document.getElementById("extension-photo-frame-picture-holder").addEventListener('click', () => {

				/*
				const picture = document.getElementById('extension-photo-frame-picture-holder');
				const overview = document.getElementById('extension-photo-frame-overview');
				this.removeClass(overview,"extension-photo-frame-hidden");
				this.addClass(picture,"extension-photo-frame-hidden");
				*/
				
				
				/*
				try {
					window.clearInterval(this.photo_interval);
				}
				catch (e) {
					console.log(e); //logMyErrors(e); // pass exception object to error handler
				}
				*/
				
				
				//window.Extension.showMenuButton();
				var menu_button = document.getElementById("menu-button");
				menu_button.click();//dispatchEvent('click');
				
				/*
				const eventAwesome = new CustomEvent('awesome', {
				  bubbles: true,
				  detail: { text: () => textarea.value }
				});
				*/
				//console.log(window.API);
				//console.log(window.Extension.showMenuButton);
				//console.log(App);
				//console.log(window.Menu);
				//window.App.Menu.show();
				
				
				//window.location = "/things";
				
      });
			

			// Get list of properties for sculptor
			
      window.API.postJson(
        `/extensions/${this.id}/api/list`,
				{'init':1}
        
      ).then((body) => {
				//console.log("List returned data");
				//console.log(body['settings']);
				
				this_object.settings = body['settings'];
				this_object.interval = body['settings']['interval'];
				this_object.contain = body['settings']['contain'];
				console.log("interval: " + this_object.interval);
				console.log("contain: " + this_object.contain);
        
				if( this.contain ){
					//console.log("contain");
					document.getElementById('extension-photo-frame-picture-holder').style.backgroundSize = "contain";
				}
				else{
					//console.log("Do not contain");
					document.getElementById('extension-photo-frame-picture-holder').style.backgroundSize = "cover";
				}
				
				
				// Interval
				//var me = this;
				this_object.photo_interval = setInterval(function () {
						//console.log("intervallo");
						this_object.change_picture();
				}, this_object.interval * 1000);
				
				if( body['data'].length > 0 ){
					//console.log("Showing initial image");
					//var random_file = body['data'][Math.floor(Math.random() * body['data'].length)];

					//console.log("this.filenames 2 = " + this.filenames);
					
					this_object.filenames = body['data'];
					this_object.show_list(body['data']);
					this_object.change_picture();
					//this.show_file(random_file);
					
					//console.log("this.filenames 3 = " + this.filenames);
					
					/*
					filenames = this.filenames;
					this.photo_interval = setInterval(function(filenames) {
							console.log("this.filenames 4 = " + this.filenames);
					    var random_file = this.filenames[Math.floor(Math.random() * this.filenames.length)];
							this.show_file(random_file);
					}, 10 * 1000); // 60 * 1000 milliseconds
					*/
				}


      }).catch((e) => {
        //pre.innerText = e.toString();
				console.log("Photo frame: error in show list function: " + e.toString());
      });
			
    }
		
		
		hide(){
			try {
				window.clearInterval(this.photo_interval);
			}
			catch (e) {
				//console.log(e); //logMyErrors(e); // pass exception object to error handler
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
				node.appendChild(imgnode); 
				
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
		    var FR= new FileReader();

				var this_object = this;
		    FR.addEventListener("load", function(e) {
					//console.log(e.target.result);
				
					//var base64_url = e.target.result
				
					var this_object2 = this_object;
					//fetch(base64_url)
					//.then(res => res.blob())
					//.then(console.log)
				
		      window.API.postJson(
		        `/extensions/photo-frame/api/save`,
		        {'action':'upload', 'filename':filename, 'filedata':e.target.result, 'parts_total':1, 'parts_current':1}

		      ).then((body) => { 
						//console.log("GOT RETURN DATA");
						//console.log(body);
		        this_object.show_list(body['data']);

		      }).catch((e) => {
						//console.log("Photo frame: error in saving photo result");
						document.getElementById('extension-photo-frame-response-data').innerText = e.toString();
		      });
				
				
				
		      //document.getElementById("img").src       = e.target.result;
		      //document.getElementById("b64").innerHTML = e.target.result;
		    }); 

		    FR.readAsDataURL( files[0] );
		  }
		}



		//function createDropzoneMethods() {
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

						//console.log(e.dataTransfer.files);
		        //upload_files(e.dataTransfer.files);
						
						var files = e.dataTransfer.files;
				    //let upload_results = document.getElementById("upload_results_element");
						
						this_object.upload_files(files);
 
		    }    

		}		
  }

  new PhotoFrame();
	
})();
