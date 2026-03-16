try:
    from gateway_addon import Adapter, Device, Property
    #print("succesfully loaded APIHandler and APIResponse from gateway_addon")
except:
    print("Could not load vital libraries to interact with the controller")



#
# ADAPTER
#

class PhotoFrameAdapter(Adapter):
    """Adapter for Photo Frame"""

    def __init__(self, verbose=False):
        """
        Initialize the object.

        verbose -- whether or not to enable verbose logging
        """
        
        self.addon_name = 'photo-frame'
        self.name = self.__class__.__name__
        self.ready = False
        Adapter.__init__(self, self.addon_name, self.addon_name, verbose=verbose)
        #print("Adapter ID = " + self.get_id())




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
        
        self._type.append("OnOffSwitch")
        
        self.name = 'PhotoFrame'
        self.title = 'Photo Frame'
        self.description = 'Thing to controll Photo Frame'
        
        if not 'properties' in self:
            if self.DEBUG:
                print("adapter: had to create self.properties")
                
            self.properties = {}

        try:
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
                            
        except Exception as ex:
            print("caught error adding properties: " + str(ex))

        if self.DEBUG:
            print("PhotoFrame thing has been created.")
            
            
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
		
        



#
# PROPERTY
#

class PhotoFrameProperty(Property):

    def __init__(self, device, name, description, value):
        Property.__init__(self, device, name, description)
        self.device = device
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
            if self.title == 'Screensaver':
                #self.device.adapter.api_handler.set_screensaver_state(bool(value))
                #self.device.adapter.set_radio_state(True) # If the user changes the station, we also play it.
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


