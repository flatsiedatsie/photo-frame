try:
    from gateway_addon import Adapter, Device, Property, Action, Event
    #print("succesfully loaded APIHandler and APIResponse from gateway_addon")
except:
    print("Could not load vital libraries to interact with the controller")



#
# ADAPTER
#

class PhotoFrameAdapter(Adapter):
    """Adapter for Photo Frame"""

    def __init__(self, api_handler, verbose=False):
        """
        Initialize the object.

        verbose -- whether or not to enable verbose logging
        """
        self.api_handler = api_handler
        self.DEBUG = bool(api_handler.DEBUG)
        self.addon_name = str(self.api_handler.addon_name) #'photo-frame'
        self.name = self.__class__.__name__
        if self.DEBUG:
            print("adapter: self.name: ", self.name)
        self.ready = False
        Adapter.__init__(self, self.addon_name, self.addon_name, verbose=verbose)
        #print("Adapter ID = " + self.get_id())
        
        try:
            # Create the thing
            self.photo_frame_device = PhotoFrameDevice(self) # ,"photo-frame","Photo frame" # are these last two parameters processed?
            self.handle_device_added(self.photo_frame_device)
            if self.DEBUG:
                print("photo frame device added")
            self.devices['photo-frame'].connected = True
            self.devices['photo-frame'].connected_notify(True)
            self.thing = self.get_device("photo-frame")
            
        except Exception as ex:
            print("caught error during photo frame adapter device init: " + str(ex))

        self.ready = True

    def remove_thing(self, device_id):
        if self.DEBUG:
            print("Removing photo_frame thing: " + str(device_id))
    
        try:
            obj = self.get_device(device_id)
            self.handle_device_removed(obj)                     # Remove from device dictionary

        except Exception as ex:
            print("Could not remove thing from PhotoFrame adapter devices: " + str(ex))



#
# DEVICE
#

class PhotoFrameDevice(Device):
    """PhotoFrame device type."""

    def __init__(self, adapter):
        """
        Initialize the object.
        adapter -- the Adapter managing this device
        """

        Device.__init__(self, adapter, 'photo-frame')
        
        self._id = 'photo-frame'
        self.id = 'photo-frame'
        self.adapter = adapter
        self.DEBUG = self.adapter.DEBUG
        
        self._type = ["OnOffSwitch"]
        
        self.name = 'photo-frame'
        self.title = 'Photo Frame'
        self.description = 'Thing to control Photo Frame'
        #self.night_mode = False
        
        self.properties = {}
        
        if not 'night_mode' in self.adapter.api_handler.persistent_data.keys():
            self.adapter.api_handler.persistent_data['night_mode'] = False

        try:
            """
            self.properties["screensaver"] = PhotoFrameProperty(
                            self,
                            "screensaver",
                            {
                                '@type': 'OnOffProperty',
                                'title': "Screensaver",
                                'type': 'boolean',
                                'readOnly': False,
                            },
                            False)
            """
            
            self.properties["night_mode"] = PhotoFrameProperty(
                            self,
                            "night_mode",
                            {
                                'title': "Night mode",
                                'type': 'boolean',
                                'readOnly': False,
                            },
                            bool(self.adapter.api_handler.persistent_data['night_mode']) )
            
            
            if self.adapter.api_handler.is_64_bit:
                self.properties["localsend"] = PhotoFrameProperty(
                            self,
                            "localsend",
                            {
                                'title': "Localsend",
                                'type': 'boolean',
                                'readOnly': False,
                                '@type': 'OnOffProperty',
                            },
                            False )
            
            """
            self.properties["current_photo_name"] = PhotoFrameProperty(
                            self,
                            "current_photo_name",
                            {
                                'title': "Current photo",
                                'type': 'string',
                                'readOnly': True
                            },
                            None)
            """
                            
            self.add_event('Start screensaver',{})
            self.add_event('Previous photo',{})
            self.add_event('Next photo',{})
            
            self.add_action("Start screensaver", {});
            
            self.add_action("Previous photo", {});
            
            self.add_action("Next photo", {});
            
            
            
        except Exception as ex:
            print("caught error adding proto-frame properties: " + str(ex))

        if self.DEBUG:
            print("debug: PhotoFrame thing has been created")
            
            
        """
        for metadata_key in list(self.adapter.metadata.keys()):
            self.properties[metadata_key] = PhotoFrameProperty(
                                self,
                                metadata_key,
                                {
                                    'title': metadata_key.capitalize(),
                                    'type': 'string',
                                    'readOnly': True,
                                },
                                "")


        try:
            if self.adapter.pipewire_enabled == False and self.adapter.audio == True:
                self.properties["audio output"] = PhotoFrameProperty(
                                self,
                                "audio output",
                                {
                                    'label': "Audio-only output",
                                    'type': 'string',
                                    'enum': audio_output_list,
                                },
                                self.adapter.persistent_data['audio_output'])

            if self.adapter.video:
                self.properties["video audio output"] = PhotoFrameProperty(
                                    self,
                                    "video audio output",
                                    {
                                        'label': "Video audio output",
                                        'type': 'string',
                                        'enum': video_audio_output_list,
                                    },
                                    self.adapter.persistent_data['video_audio_output'])

		"""
		
    def perform_action(self,action):
        if self.DEBUG:
            print("in perform_action")
            if action:
                print("perform_action: Action.as_dict(): ", action.as_dict())
            print("perform_action: self.events: ", self.events)
        action_to_perform = action.as_dict()
        if 'name' in action_to_perform:
            if self.DEBUG:
                print("action to perform name: ", action_to_perform['name'])
            
            if str(action_to_perform['name']) == 'Next photo':
                next_photo_event = Event(self,'Next photo')
                self.event_notify(next_photo_event)
                if self.adapter.api_handler.persistent_data['night_mode'] == True:
                    self.set_property('night_mode',False,{'origin':'action'})
                
            elif str(action_to_perform['name']) == 'Previous photo':
                previous_photo_event = Event(self,'Previous photo')
                self.event_notify(previous_photo_event)
                if self.adapter.api_handler.persistent_data['night_mode'] == True:
                    self.set_property('night_mode',False,{'origin':'action'})
                    
            elif str(action_to_perform['name']) == 'Start screensaver':
                start_screensaver_event = Event(self,'Start screensaver')
                self.event_notify(start_screensaver_event)
                
            else:
                if self.DEBUG:
                    print("perform_action: fell through")
        
        

#
# PROPERTY
#

class PhotoFrameProperty(Property):

    def __init__(self, device, name, description, value):
        Property.__init__(self, device, name, description)
        self.device = device
        self.id = name
        self.name = name
        self.title = name
        self.description = description # dictionary
        self.value = value
        self.set_cached_value(value)
        self.device.notify_property_changed(self)


    def set_value(self, value):
        #print("property: set_value called for " + str(self.title))
        #print("property: set value to: " + str(value))
        try:
            if self.id == 'screensaver':
                #self.device.adapter.api_handler.set_screensaver_state(bool(value))
                #self.device.adapter.set_radio_state(True) # If the user changes the station, we also play it.
                self.update(bool(value))

            elif self.id == 'night_mode':
                #self.device.adapter.api_handler.set_screensaver_state(bool(value))
                #self.device.adapter.set_radio_state(True) # If the user changes the station, we also play it.
                
                self.device.adapter.api_handler.persistent_data['night_mode'] = bool(value)
                self.update(bool(value))
                
                
            elif self.id == 'localsend-cli':
                #self.device.adapter.api_handler.set_screensaver_state(bool(value))
                #self.device.adapter.set_radio_state(True) # If the user changes the station, we also play it.
                
                self.device.adapter.api_handler.set_localsend(bool(value))
                self.update(bool(value))
                
                
            #if self.title == 'Show next photo':
                #pass
                #self.device.adapter.api_handler.set_screensaver_state(bool(value))
                #self.device.adapter.set_radio_state(True) # If the user changes the station, we also play it.
                #self.update(bool(value))

            #if self.title == 'video audio output':
            #    self.device.adapter.set_video_audio_output(str(value))

            #if self.title == 'state':
            #    self.device.adapter.set_state(bool(value))

            #if self.title == 'power':
            #    self.device.adapter.set_photo_frame_state(bool(value))
                #self.update(value)

            #if self.title == 'volume':
            #    self.device.adapter.set_photo_frame_volume(int(value))
                #self.update(value)

        except Exception as ex:
            print("caught set_value error: " + str(ex))



    def update(self, value):
        #print("property -> update")
        if value != self.value:
            self.value = value
            self.set_cached_value(value)
            self.device.notify_property_changed(self)


