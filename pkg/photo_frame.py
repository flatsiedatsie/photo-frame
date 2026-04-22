"""Photo Frame API handler."""


import functools
import json
import os
import re
import sys
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
#from os import listdir
#from os.path import isfile, join
import time
#from time import sleep, time
import random
import string
#import datetime
from datetime import datetime,timedelta
#from dateutil import tz
#from dateutil.parser import *

# Timezones
#try:
#    from pytz import timezone
#    import pytz
#except:
#    print("ERROR, pytz is not installed. try 'pip3 install pytz'")


import subprocess
import threading
import requests
import base64
#from pynput.keyboard import Key, Controller

try:
    from gateway_addon import APIHandler, APIResponse
    #print("succesfully loaded APIHandler and APIResponse from gateway_addon")
except:
    print("Import APIHandler and APIResponse from gateway_addon failed. Use at least WebThings Gateway version 0.10")

try:
    from gateway_addon import Adapter, Device, Database
except:
    print("Gateway addon not loaded?!")
    
from .photo_frame_adapter import *

print = functools.partial(print, flush=True)



_TIMEOUT = 3

_CONFIG_PATHS = [
    os.path.join(os.path.expanduser('~'), '.webthings', 'config'),
]

if 'WEBTHINGS_HOME' in os.environ:
    _CONFIG_PATHS.insert(0, os.path.join(os.environ['WEBTHINGS_HOME'], 'config'))




class PhotoFrameAPIHandler(APIHandler):
    """Power settings API handler."""

    def __init__(self, verbose=False):
        """Initialize the object."""
        #print("INSIDE API HANDLER INIT")
        
        
        self.ready = False
        self.running = True
        self.addon_name = 'photo-frame'
        self.server = 'http://127.0.0.1:8080'
        self.is_64_bit = (sys.maxsize > 2**32)
        
        self.DEV = False
        self.DEBUG = False
        
        
        self.persistent_data = {}
        
        self.things = [] # Holds all the things, updated via the API. Used to display a nicer thing name instead of the technical internal ID.
        self.data_types_lookup_table = {}
            
        self.interval = 30
        self.screensaver_delay = 60
        self.fit_to_screen = "mix"
        self.show_clock = False
        self.show_date = False
        self.show_weather = False
        
        self.show_voco_timers = True
        self.voco_persistent_data = {}
        self.time_zone = str(time.tzname[0])
        self.seconds_offset_from_utc = -time.timezone

        self.animations = True
        self.greyscale = False
        
        
        self.boot_path = '/boot'
        if os.path.exists('/boot/firmware'):
            self.boot_path = '/boot/firmware'
        
        # Printers
        self.printing_allowed = False
        if not os.path.exists(self.boot_path + '/candle_disable_printing.txt'):
            self.printing_allowed = True
        self.has_cups = False
        if os.path.exists('/etc/cups'):
            self.has_cups = True
            
        self.cups_printer_available = False
        self.peripage_printer_available = False
        self.last_printers_check_time = 0
        #os.environ["DISPLAY"] = ":0.0"
            
        self.weather_addon_exists = False
        
        
        # Privacy mode
        
        self.check_for_new_things = True
        
        
        # Localsend
        self.localsend_name = str(run_command('hostname')).strip().rstrip()
        self.localsend_process = None
        self.localsend_messages = []
        self.localsend_pin = None
        
            
        try:
            manifest_fname = os.path.join(
                os.path.dirname(__file__),
                '..',
                'manifest.json'
            )

            with open(manifest_fname, 'rt') as f:
                try:
                    manifest = json.load(f)
                except Exception as ex:
                    print("Error loading manifest.json: " + str(ex))
            
            #print("manifest['id']: " + str(manifest['id']))
            APIHandler.__init__(self, manifest['id'])
            
            

            

            
            if self.DEBUG:
                print("self.manager_proxy = " + str(self.manager_proxy))
                print("Created new API HANDLER: " + str(manifest['id']))
        except Exception as e:
            if self.DEBUG:
                print("Failed to init UX extension API handler: " + str(e))
        
        
        self.create_thing = False
        
        # LOAD CONFIG
        try:
            self.add_from_config()
        except Exception as ex:
            print("caught error loading config: " + str(ex))
            
        
        
        
        
            
        
        
            
        self.addon_path = os.path.join(self.user_profile['addonsDir'], self.addon_name)
        #self.persistence_file_folder = os.path.join(self.user_profile['configDir'])
        self.persistence_file_path = os.path.join(self.user_profile['dataDir'], self.addon_name, 'persistence.json')
        self.photos_dir_path = os.path.join(self.addon_path, 'photos')
        self.photos_data_dir_path = os.path.join(self.user_profile['dataDir'], self.addon_name, 'photos')
        if not os.path.isdir(self.photos_data_dir_path):
            if self.DEBUG:
                print("creating photos directory in data path")
            os.mkdir(self.photos_data_dir_path)
        
        self.demo_photo_file_path = os.path.join(self.addon_path, 'demo_photo.jpg')
        self.demo_photo2_file_path = os.path.join(self.addon_path, 'demo_photo2.jpg')
        self.demo_photo3_file_path = os.path.join(self.addon_path, 'demo_photo3.jpg')
        self.demo_photo4_file_path = os.path.join(self.addon_path, 'demo_photo4.jpg')
        self.external_picture_drop_dir = os.path.join(self.user_profile['dataDir'], 'privacy-manager', 'printme')
        self.display_toggle_path = os.path.join(self.user_profile['addonsDir'], 'display-toggle')
        self.localsend_path = os.path.join(self.addon_path,'localsend','localsend_cli64')
        if os.path.isfile(self.localsend_path):
            os.system('chmod +x ' + str(self.localsend_path))
        
        # weather
        self.weather_addon_path =  os.path.join(self.user_profile['addonsDir'], 'weather-adapter')
        if os.path.isdir(self.weather_addon_path):
            self.weather_addon_exists = True
        
        # Voco
        self.voco_persistent_data = {}
        self.voco_persistence_file_path =  os.path.join(self.user_profile['dataDir'], 'voco','persistence.json')
        if not os.path.isfile(self.voco_persistence_file_path):
            if self.DEBUG:
                print("Voco is not installed, no need to check voco timers")
            self.show_voco_timers = False
        
        
        
        soft_link = 'ln -s ' + str(self.photos_data_dir_path) + " " + str(self.photos_dir_path)
        if self.DEBUG:
            print("debug: linking: " + soft_link)
        os.system('rm -rf ' + str(self.photos_dir_path))
        os.system(soft_link)
        
        
        
       
        try:
            with open(self.persistence_file_path) as f:
                self.persistent_data = json.load(f)
                if self.DEBUG:
                    print('self.persistent_data loaded from file: ' + str(self.persistent_data))
                
        except Exception as ex:
            if self.DEBUG:
                print("Could not load persistent data (if you just installed the add-on then this is normal). The error was: ", ex)
            self.persistent_data = {}

        if not 'safe_photos' in self.persistent_data.keys():
            self.persistent_data['safe_photos'] = []

        if not 'password_enabled' in self.persistent_data.keys():
            self.persistent_data['password_enabled'] = False
            if self.DEBUG:
                print("setting initial password_enabled in persistent_data to False")
        
        if not 'password_hash' in self.persistent_data.keys():
            self.persistent_data['password_hash'] = ''
            
        if not 'password_length' in self.persistent_data.keys():
            self.persistent_data['password_length'] = None
            if self.DEBUG:
                print("setting initial password_length in persistent_data to None")

        if not 'privacy_mode_end_time' in self.persistent_data.keys():
            self.persistent_data['privacy_mode_end_time'] = 0
        
        if not 'night_mode' in self.persistent_data.keys():
            self.persistent_data['night_mode'] = False
            
        if not 'added_a_photo' in self.persistent_data.keys():
            self.persistent_data['added_a_photo'] = False
            self.save_persistent_data()
        
        if self.DEBUG:
            print("initial self.persistent_data: ", self.persistent_data)
        

        self.manager_proxy.add_api_handler(self)
        
        # TODO: DEBUG TEST
        self.create_thing = True


        self.adapter = None  
        if self.create_thing:
            try:
                self.adapter = PhotoFrameAdapter(self,verbose=False)
                if self.DEBUG:
                    print("debug: ADAPTER created")
            except Exception as ex:
                if self.DEBUG:
                    print("Failed to start ADAPTER. Error: " + str(ex))


        # Can we print photos?
        self.check_photo_printer()
              
        # Screensaver
        if not os.path.isdir(self.display_toggle_path):
            # Only keep the display on if the display toggle addon isn't installed.
            if self.screensaver_delay > 0:
                os.system('xset -display :0 s off')
                os.system('xset -display :0 s noblank')
                os.system('xset -display :0 -dpms')
            
            
        # Respond to gateway version
        try:
            if self.DEBUG:
                print("Gateway version: " + self.gateway_version)
        except:
            if self.DEBUG:
                print("self.gateway_version did not exist")
        
        if self.DEBUG:
            print("self.is_64_bit: ", self.is_64_bit)
        
        try:
            if len(self.scan_photo_dir()) == 0:
            
                # only copy the demo photo once, so that the user can choose to have no photos at all, which will turn the screensaver into a black screen.
                if not 'demo_photo_copied' in self.persistent_data:
            
                    if self.DEBUG:
                        print("no photos yet. Copying demo photos")
            
                    os.system('cp ' + str(self.demo_photo_file_path) + ' ' + str(self.photos_data_dir_path))
                    os.system('cp ' + str(self.demo_photo2_file_path) + ' ' + str(self.photos_data_dir_path))
                    os.system('cp ' + str(self.demo_photo3_file_path) + ' ' + str(self.photos_data_dir_path))
                    os.system('cp ' + str(self.demo_photo4_file_path) + ' ' + str(self.photos_data_dir_path))
            
                    self.persistent_data['demo_photo_copied'] = True # this makes it possible to not show any photos at all (a black background)
                    self.save_persistent_data()
        except Exception as ex:
            if self.DEBUG:
                print("caught error checking scan_photo_dir: ", ex)
        
        
        self.ready = True
        
        return None



    # Read the settings from the add-on settings page
    def add_from_config(self):
        """Attempt to add all configured devices."""
        try:
            database = Database(self.addon_name)
            if not database.open():
                print("Could not open settings database")
                return
            
            config = database.load_config()
            database.close()
            
        except:
            print("Error! Failed to open settings database.")
            self.close_proxy()
        
        if not config:
            print("Error loading config from database")
            return
        
        if self.DEV:
            print(str(config))

        if 'Debugging' in config:
            self.DEBUG = bool(config['Debugging'])
            if self.DEBUG:
                print("-Debugging preference was in config: " + str(self.DEBUG))
                
        if 'Debug' in config:
            self.DEBUG = bool(config['Debug'])
            if self.DEBUG:
                print("-Debug preference was in config: " + str(self.DEBUG))

        if 'Interval' in config:
            self.interval = int(config['Interval'])
            if self.DEBUG:
                print("-Interval preference was in config: " + str(self.interval))
                
        if 'Screensaver delay' in config:
            self.screensaver_delay = int(config['Screensaver delay'])
            if self.DEBUG:
                print("-Screensaver delay preference was in config: " + str(self.screensaver_delay))

        if 'Fit to screen' in config:
            self.fit_to_screen = str(config['Fit to screen']) # can be "cover", "contain" or "mix"
            if self.DEBUG:
                print("-Fit to screen preference was in config: " + str(self.fit_to_screen))
                
        if "Animations and effects" in config:
            self.animations = bool(config['Animations and effects']) # can be "cover", "contain" or "mix"
            if self.DEBUG:
                print("Animations preference was in config: " + str(self.animations))
                
        if "Black and white" in config:
            self.greyscale = bool(config["Black and white"]) # can be "cover", "contain" or "mix"
            if self.DEBUG:
                print("Black and white preference was in config: " + str(self.greyscale))
                
        if 'Show date' in config:
            self.show_date = bool(config['Show date'])
            if self.DEBUG:
                print("-Date preference was in config: " + str(self.show_date))

        if 'Show clock' in config:
            self.show_clock = bool(config['Show clock'])
            if self.DEBUG:
                print("-Clock preference was in config: " + str(self.show_clock))

        if 'Show weather' in config:
            self.show_weather = bool(config['Show weather'])
            if self.DEBUG:
                print("-Weather preference was in config: " + str(self.show_weather))

        if 'Show Voco timers' in config:
            self.show_voco_timers = bool(config['Show Voco timers'])
            if self.DEBUG:
                print("-Show Voco timers preference was in config: " + str(self.show_voco_timers))

        if 'Create control thing' in config:
            self.create_thing = bool(config['Create control thing'])
            if self.DEBUG:
                print("-Create thing preference was in config: " + str(self.create_thing))

        if 'Localsend pin' in config:
            self.localsend_pin = int(config['Localsend pin'])
            if self.DEBUG:
                print("-Localsend pin was in config: " + str(self.localsend_pin))
        


    def update_photo_name_on_thing(self):
        if self.DEBUG:
            print("in update_photo_name_on_thing")
            
        #current_photo_name





    def handle_request(self, request):
        """
        Handle a new API request for this handler.

        request -- APIRequest object
        """
        
        try:
        
            if request.method != 'POST':
                if self.DEBUG:
                    print("api error: not a post request")
                return APIResponse(status=404)
            
            if request.path == '/ajax' or request.path == '/init' or request.path == '/list' or request.path == '/poll' or request.path == '/delete' or request.path == '/save' or request.path == '/get_random' or request.path == '/wake' or request.path == '/print' or request.path == '/get_time':

                try:
                    
                    if request.path == '/ajax':
                        if self.DEBUG:
                            print("API received request to /ajax")
                        
                        state = False
                        
                        if 'action' in request.body:
                            action = str(request.body['action'])
                        
                            if action == 'save_safe_photos':
                                if 'safe_photos' in request.body and isinstance(request.body['safe_photos'],list):
                                    self.persistent_data['safe_photos'] = request.body['safe_photos']
                                    self.save_persistent_data()
                                    state = True
                            
                            elif action == 'enable_password':
                                if 'password_hash' in request.body and isinstance(request.body['password_hash'],str):
                                    self.persistent_data['password_hash'] = request.body['password_hash']
                                if 'password_length' in request.body and isinstance(request.body['password_length'],int):
                                    self.persistent_data['password_length'] = request.body['password_length']
                                if 'enabled' in request.body and isinstance(request.body['enabled'],bool):
                                    self.persistent_data['password_enabled'] = request.body['enabled']
                                    self.save_persistent_data()
                                    state = True
                            
                            elif action == 'save_privacy_mode_end_time':
                                if 'value' in request.body and isinstance(request.body['value'],(int,float)):
                                    self.persistent_data['privacy_mode_end_time'] = request.body['value']
                                    self.save_persistent_data()
                                    state = True
                                    
                            elif action == 'set_localsend':
                                if 'state' in request.body and isinstance(request.body['state'],bool):
                                    self.set_localsend(request.body['state'])
                                    state = True
                    
                            elif action == 'set_night_mode':
                                if 'state' in request.body and isinstance(request.body['state'],bool):
                                    self.persistent_data['night_mode'] = request.body['state']
                                    self.save_persistent_data()
                                    if self.adapter and self.adapter.thing:
                                        try:
                                            self.adapter.thing.set_property('night_mode',self.persistent_data['night_mode'],{'origin':'Addon UI'})
                                            state = True
                                        except Exception as ex:
                                            if self.DEBUG:
                                                print("caught error changing value or night_mode property on Photo Frame thing: ", ex)
                        
                        
                        
                        return APIResponse(
                          status=200,
                          content_type='application/json',
                          content=json.dumps({'state' : state,
                                              'safe_photos':self.persistent_data['safe_photos'],
                                              'privacy_mode_end_time':self.persistent_data['privacy_mode_end_time'],
                                              'night_mode':self.persistent_data['night_mode'],
                                              'localsend_name':self.localsend_name
                                            }),
                        )
                    
                    
                    elif request.path == '/list':
                        if self.DEBUG:
                            print("API: /list was called.  self.persistent_data: ", self.persistent_data)
                            
                        # Get the list of photos
                        try:
                            data = self.scan_photo_dir()
                            if isinstance(data, str):
                                state = 'error'
                            else:
                                state = 'ok'
                                
                            self.check_photo_printer()
                            
                            localsend_running = False
                            try:
                                latest_localsend_messages = self.localsend_messages
                                if self.DEBUG:
                                    print("number of localsend stdout messages: ", len(self.localsend_messages))
                                self.localsend_messages = []
                                
                                if self.localsend_process and self.localsend_process.poll() == None:
                                    localsend_running = True
                            except Exception as ex:
                                if self.DEBUG:
                                    print("/list caught error checking localsend process: ", ex)
                            if self.DEBUG:
                                print("localsend_running: ", localsend_running)
                            
                            
                            if not 'safe_photos' in self.persistent_data:
                                if self.DEBUG:
                                    print("\nERROR, somehow safe_photos was not in self.persistent_data")
                                self.persistent_data['safe_photos'] = []
                            
                            if not 'privacy_mode_end_time' in self.persistent_data:
                                if self.DEBUG:
                                    print("\nERROR, somehow privacy_mode_end_time was not in self.persistent_data")
                                self.persistent_data['privacy_mode_end_time'] = 0
                                
                            if not 'password_hash' in self.persistent_data:
                                if self.DEBUG:
                                    print("\nERROR, somehow password_hash was not in self.persistent_data")
                                self.persistent_data['password_hash'] = ''
                                
                            if not 'password_length' in self.persistent_data:
                                if self.DEBUG:
                                    print("\nERROR, somehow password_length was not in self.persistent_data")
                                self.persistent_data['password_length'] = None
                            
                            if not 'night_mode' in self.persistent_data:
                                if self.DEBUG:
                                    print("\nERROR, somehow night_mode was not in self.persistent_data")
                                self.persistent_data['night_mode'] = False
                            
                            return APIResponse(
                              status=200,
                              content_type='application/json',
                              content=json.dumps({'state' : state, 
                                                  'data' : data, 
                                                  'added_a_photo':self.persistent_data['added_a_photo'],
                                                  'safe_photos': self.persistent_data['safe_photos'],
                                                  'privacy_mode_end_time':self.persistent_data['privacy_mode_end_time'],
                                                  'interval':self.interval,
                                                  'screensaver_delay': self.screensaver_delay, 
                                                  'fit_to_screen':self.fit_to_screen, 
                                                  'show_clock' : self.show_clock, 
                                                  'show_date' : self.show_date,
                                                  'show_weather' : self.show_weather,
                                                  'show_voco_timers':self.show_voco_timers,
                                                  'peripage_printer_available':self.peripage_printer_available, 
                                                  'cups_printer_available':self.cups_printer_available, 
                                                  'weather_addon_exists':self.weather_addon_exists, 
                                                  'animations':self.animations,
                                                  'greyscale':self.greyscale,
                                                  'printing_allowed':self.printing_allowed,
                                                  'cups_printer_available':self.cups_printer_available,
                                                  'peripage_printer_available':self.peripage_printer_available,
                                                  'password_hash':self.persistent_data['password_hash'],
                                                  'password_length':self.persistent_data['password_length'],
                                                  'password_enabled':self.persistent_data['password_enabled'],
                                                  'night_mode':self.persistent_data['night_mode'],
                                                  'is_64_bit':self.is_64_bit,
                                                  'localsend_messages':latest_localsend_messages,
                                                  'localsend_running':localsend_running,
                                                  'localsend_name':self.localsend_name,
                                                  'debug':self.DEBUG
                                                }),
                            )
                        except Exception as ex:
                            if self.DEBUG:
                                print("caught error getting /list data: " + str(ex))
                            return APIResponse(
                              status=500,
                              content_type='application/json',
                              content=json.dumps({"state":False,"message":"caught error while getting list data: " + str(ex)}),
                            )
                            
                            
                    # POll for VoCo timers. /list is used for somewhat slow but regular polling
                    elif request.path == '/poll':
                        if self.DEBUG:
                            print("request at /poll")
                        state = False
                        # Get the list of Voco timers
                        try:
                            if self.show_voco_timers:
                                
                                try:
                                    with open(self.voco_persistence_file_path) as f:
                                        self.voco_persistent_data = json.load(f)
                                        #if self.DEBUG:
                                        #    print('self.voco_persistence_file_path loaded from file: ' + str(self.voco_persistent_data))
                                        if 'action_times' in self.voco_persistent_data['action_times']:
                                            action_count = len( self.voco_persistent_data['action_times'] )
                                            state = True
                                            """
                                            try:
                                                self.user_timezone = timezone(self.time_zone)
                                                self.seconds_offset_from_utc = (time.timezone if (time.localtime().tm_isdst == 0) else time.altzone) * -1
                                                if self.DEBUG:
                                                    print("Simpler timezone offset in seconds = " + str(self.seconds_offset_from_utc))
            
                                            except Exception as ex:
                                                if self.DEBUG:
                                                    print("Error handling time zone calculation: " + str(ex))
                                            
                                            
                                            for i in range(action_count):
                            
                                                try:
                                                    utc_timestamp = int(self.voco_persistent_data['action_times'][i]['moment'])
                                                    localized_timestamp = int(utc_timestamp) + int(self.seconds_offset_from_utc)
                                                    hacky_datetime = datetime.utcfromtimestamp(localized_timestamp)

                                                    #print("human readable hour = " + str(hacky_datetime.hour))
                                                    #print("human readable minute = " + str(hacky_datetime.minute))
        
                                                    clock = {} 
                                                    clock['month'] = hacky_datetime.month
                                                    clock['day'] = hacky_datetime.day
                                                    clock['hours'] = hacky_datetime.hour
                                                    clock['minutes'] = hacky_datetime.minute
                                                    clock['seconds'] = hacky_datetime.second
                                                    clock['seconds_to_go'] = utc_timestamp - self.current_utc_time
                                                    #print("seconds to go: " + str(clock['seconds_to_go']))
                                                    self.voco_persistent_data['action_times'][i]['clock'] = clock
        
                                                except Exception as ex:
                                                    if self.DEBUG:
                                                        print("Error calculating time: " + str(ex))
                                                    state = False
                                            """
                
                
                                except Exception as ex:
                                    if self.DEBUG:
                                        print("Error, could not load Voco persistent data file: " + str(ex))
                            
                            if time.time() - self.last_printers_check_time > 600:
                                self.last_printers_check_time = time.time()
                                self.check_photo_printer()
                            
                            return APIResponse(
                              status=200,
                              content_type='application/json',
                              content=json.dumps({'state' : state,
                                                  'show_voco_timers':self.show_voco_timers,
                                                  'action_times':self.voco_persistent_data['action_times'],
                                                  'timezone':self.time_zone,
                                                  'seconds_offset_from_utc':self.seconds_offset_from_utc,
                                                  'printing_allowed':self.printing_allowed,
                                                  'cups_printer_available':self.cups_printer_available,
                                                  'peripage_printer_available':self.peripage_printer_available
                                                }),
                            )
                        except Exception as ex:
                            if self.DEBUG:
                                print("caught error returning poll data: " + str(ex))
                            return APIResponse(
                              status=500,
                              content_type='application/json',
                              content=json.dumps({"state":False,"message:":"caught error while getting thing data: " + str(ex)}),
                            )
                            
                            
                            
                            
                            
                            
                            
                            
                            
                            
                            
                    elif request.path == '/delete':
                        if self.DEBUG:
                            print("DELETING")
                        try:
                            data = []
                            #target_data_type = self.data_types_lookup_table[int(request.body['property_id'])]
                            #print("target data type from internal lookup table: " + str(target_data_type))
                            # action, data_type, property_id, new_value, old_date, new_date
                            data = self.delete_file( str(request.body['filename']) )
                            if isinstance(data, str):
                                state = 'error'
                            else:
                                state = 'ok'
                            
                            return APIResponse(
                              status=200,
                              content_type='application/json',
                              content=json.dumps({'state' : state, 'data' : data}),
                            )
                        except Exception as ex:
                            if self.DEBUG:
                                print("caught error getting thing data: " + str(ex))
                            return APIResponse(
                              status=500,
                              content_type='application/json',
                              content=json.dumps({"state":False,"message:":"caught error while changing point: " + str(ex)}),
                            )
                            
                            
                            
                    elif request.path == '/save':
                        #if self.DEBUG:
                        #print("SAVING")
                        try:
                            data = []
                            
                            data = self.save_photo(str(request.body['filename']), str(request.body['filedata']), str(request.body['parts_total']), str(request.body['parts_current']) ) #new_value,date,property_id
                            if isinstance(data, str):
                                state = 'error'
                            else:
                                state = 'ok'
                            #print("return state: " + str(state))
                            return APIResponse(
                              status=200,
                              content_type='application/json',
                              content=json.dumps({'state' : state, 'data' : data}),
                            )
                        except Exception as ex:
                            if self.DEBUG:
                                print("caught error saving photo: " + str(ex))
                            return APIResponse(
                              status=500,
                              content_type='application/json',
                              content=json.dumps({"state":False,"message:":"caught error while saving photo: " + str(ex)}),
                            )
                        
                    
                    
                    elif request.path == '/get_random':
                        if self.DEBUG:
                            print("DOWNLOADING RANDOM IMAGE")
                        state = False
                        dir_list = []
                        try:
                            display_width = 1920 #int(request.body['width'])
                            display_height = 1080 #int(request.body['height'])
                            os.system('wget -P ' + str(self.photos_data_dir_path) + ' https://unsplash.it/' + str(display_width) + '/' + str(display_height) + ' -O ' + str(self.photos_data_dir_path) + '/zzz' + str(generate_random_string(12)) + '.jpg')
                            dir_list = self.scan_photo_dir()
                            state = True
                        except Exception as ex:
                            if self.DEBUG:
                                print("caught error downloading random photo: " + str(ex))
                        
                        return APIResponse(
                          status=200,
                          content_type='application/json',
                          content=json.dumps({'state': state, 'data': dir_list}),
                        )
                    
                    
                    
                    
                    
                    
                    
                    # No longer used.
                    elif request.path == '/wake':
                        if self.DEBUG:
                            print("WAKING")
                        
                        try:
                            #cmd = 'DISPLAY=:0 xset dpms force on'
                            #os.system(cmd)
                            return APIResponse(
                              status=200,
                              content_type='application/json',
                              content=json.dumps({'state' : 'woken'}),
                            )
                        except Exception as ex:
                            if self.DEBUG:
                                print("caught error waking dispay: " + str(ex))
                            return APIResponse(
                              status=500,
                              content_type='application/json',
                              content=json.dumps({"state":False,"message:":"caught error while waking up the display: " + str(ex)}),
                            )

                    
                    elif request.path == '/get_time':
                        if self.DEBUG:
                            print("in /get_time")
                        try:
                            # Fri 19 Aug 19:44:29 CEST 2022
                            system_date = run_command('date')
                            system_date = system_date.replace('  ', ' ')
                            system_date = system_date.replace('  ', ' ')
                            system_date = system_date.replace('  ', ' ')
                            system_date = system_date.split(' ')
                            
                            #print("system_date: " + str(system_date))
                            #print("len(system_date): " + str(len(system_date)))
                            system_time = system_date[3]
                            #print("system_time: " + str(system_time))
                            #print("len(system_time): " + str(len(system_time)))
                            #if self.DEBUG:
                            #    print("system_time from system_date: " + str(system_time))
                            time_parts = system_time.split(':')
                            
                            return APIResponse(
                              status=200,
                              content_type='application/json',
                              content=json.dumps({'state' : 'ok', 
                                                  'day_name':system_date[0], 
                                                  'date':system_date[1], 
                                                  'month':system_date[2], 
                                                  'hours':time_parts[0], 
                                                  'minutes':time_parts[1],
                                                  'timezone':self.time_zone,
                                                  'seconds_offset_from_utc':-time.timezone
                                              }),
                            )
                        except Exception as ex:
                            if self.DEBUG:
                                print("caught error returning system time: " + str(ex))
                            return APIResponse(
                              status=500,
                              content_type='application/json',
                              content=json.dumps({"state":False,"message:":"caught error while returning system time: " + str(ex)}),
                            )
                    
                    
                    
                    elif request.path == '/print':
                        if self.DEBUG:
                            print("printing")
                        state = 'sent to printer'
                        
                        try:
                            from_filename = os.path.join(self.photos_data_dir_path, str(request.body['filename']))
                            if os.path.isfile(from_filename):
                                if self.peripage_printer_available:
                                    if os.path.isdir(self.external_picture_drop_dir):
                                        to_filename = os.path.join(self.external_picture_drop_dir, str(request.body['filename']))
                                        copy_command = 'cp -n ' + str(from_filename) + ' ' + str(to_filename)
                                        if self.DEBUG:
                                            print("copy_command: " + str(copy_command))
                                        os.system(copy_command)
                                    else:
                                        if self.DEBUG:
                                            print("photo drop dir (no longer) exists?")
                                        state = 'drop off directory did not exist'
                                        
                                elif self.cups_printer_available:
                                    print_command = 'lp -o printer-error-policy=abort-job ' + str(from_filename)
                                    if self.DEBUG:
                                        print("printing using cups. Print command: \n" + str(print_command))
                                    os.system(print_command)
                                    state = "Photo sent to (network) printer"
                            
                            else:
                                if self.DEBUG:
                                    print("file to be printed did not exist")
                                state = 'file did not exist'
                            
                            return APIResponse(
                              status=200,
                              content_type='application/json',
                              content=json.dumps({'state':state}),
                            )
                        except Exception as ex:
                            if self.DEBUG:
                                print("caught error sending photo to printer: " + str(ex))
                            return APIResponse(
                              status=500,
                              content_type='application/json',
                              content=json.dumps({"state":False,"message:":"caught error while sending file to printer drop-off directory: " + str(ex)}),
                            )

                        
                        
                    else:
                        return APIResponse(
                          status=404,
                          content_type='application/json',
                          content=json.dumps({"state":False,"message:":"API error"}),
                        )
                        
                        
                except Exception as ex:
                    if self.DEBUG:
                        print("caught error in API handler: ",str(ex))
                    return APIResponse(
                      status=500,
                      content_type='application/json',
                      content=json.dumps({"state":False,"message:":"Error"}),
                    )
                    
            else:
                if self.DEBUG:
                    print("unknown API path")
                return APIResponse(status=404)
                
        except Exception as e:
            if self.DEBUG:
                print("Failed to handle UX extension API request: " + str(e))
        
        return APIResponse(
          status=500,
          content_type='application/json',
          content=json.dumps({"state":False,"message:":"general API Error"}),
        )
        



    # INIT
    #def get_init_data(self):
    #    if self.DEBUG:
    #        print("Getting the initialisation data")
        





        
    # DELETE A FILE
    
    def delete_file(self,filename):
        result = "error"
        try:
            file_path = os.path.join(self.photos_dir_path, str(filename))
            os.remove(file_path)
            result = self.scan_photo_dir()
        except Exception as ex:
            if self.DEBUG:
                print("caught error deleting photo: " + str(ex))
        
        return result



    def scan_photo_dir(self):
        result = []
        try:
            if not os.path.isdir(self.photos_data_dir_path):
                os.system('mkdir ' + str(self.photos_data_dir_path))
                if self.DEBUG:
                    print("scan_photo_dir: had to create missing data photos directory: ", self.photos_data_dir_path)
            for fname in os.listdir(self.photos_dir_path):
                if fname.endswith(".jpg") or fname.endswith(".jpeg") or fname.endswith(".gif")  or fname.endswith(".png")  or fname.endswith(".webp"):
                    result.append(fname)
            if len(result) > 4:
                if self.persistent_data['added_a_photo'] == False:
                    self.persistent_data['added_a_photo'] = True
                    self.save_persistent_data()
        except Exception as ex:
            if self.DEBUG:
                print("caught error scanning photo directory: ", ex)
        
    
        
        return result

        
    
    
    def set_localsend(self,state):
        
        try:
            if os.path.isfile(self.localsend_path):
            
                if bool(state) == True:
                    if self.localsend_process == None:
                        if self.DEBUG:
                            print("starting localsend_cli")
                
                        hostname = run_command('hostname')
                        if isinstance(hostname,str):
                            hostname = hostname.strip().rstrip()
                            hostname = hostname.replace(' ','_')
                        else:
                            hostname = 'Candle_' + str(generate_random_string(4))
                        self.localsend_name = str(hostname)
                        localsend_command = [str(self.localsend_path),"recv","--devname",hostname,"--dir",str(self.photos_data_dir_path)]
                        
                        if self.localsend_pin and str(self.localsend_pin).isdigit() and int(self.localsend_pin) > 0:
                            localsend_command.append('--pin')
                            localsend_command.append(str(self.localsend_pin))
                        
                        if self.DEBUG:
                            print("\nlocalsend command:\n" + ' '.join(localsend_command) + "\n")
                        self.localsend_process = subprocess.Popen(localsend_command, stderr=subprocess.DEVNULL, shell=False, stdout=subprocess.DEVNULL)  # stdin=subprocess.PIPE,  stdout=subprocess.PIPE
                        
                        """
                        def read_stdout():
                            while self.running:
                                msg = self.localsend_process.stdout.readline()
                                new_msg = msg.decode();
                                if len(str(new_msg)) > 2:
                                    if self.DEBUG:
                                        print("localsend output: ", new_msg)
                                    self.localsend_messages.append(new_msg)
                                time.sleep(0.0001)
                            if self.DEBUG:
                                print("localsend read_stdout closed")
                    
                            # Superfluous?
                            if self.localsend_process and self.localsend_process.poll() == None:
                                 self.localsend_process.terminate()
                                 time.sleep(0.3)
                                 if self.localsend_process and self.localsend_process.poll() == None:
                                     self.localsend_process.kill()
                                     time.sleep(0.3)
                                     if self.localsend_process and self.tcpdump.poll() == None:
                                         os.system('sudo pkill -f localsend_cli')
                            self.localsend_process = None
                    
                        self.stdout_thread = threading.Thread(target=read_stdout)
                        self.stdout_thread.daemon = True
                        self.stdout_thread.start()
                        """
                        
                    elif self.localsend_process.poll() == None:
                        if self.DEBUG:
                            print("set_localsend: was asked to start localsend, but it's already running?")
                    else:
                        if self.DEBUG:
                            print("set_localsend: self.localsend_process was not null, but it's also not running?")
                            try:
                                print("self.localsend_process.returncode: ", self.localsend_process.returncode)
                            except Exception as ex:
                                print("caught error getting localsend .returncode: ", ex)
                        self.localsend_proces = None
                        
                else:
                    if self.localsend_process != None and self.localsend_process.poll() == None:
                        if self.DEBUG:
                            print("attempting to terminate localsend_cli")
                        self.localsend_process.terminate()
                        time.sleep(.5)
                        if self.localsend_process != None and self.localsend_process.poll() == None:
                            if self.DEBUG:
                                print("ERROR, localsend_cli had to be killed")
                            self.localsend_process.kill()
                            time.sleep(.5)
                            if self.localsend_process != None and self.localsend_process.poll() == None:
                                if self.DEBUG:
                                    print("ERROR, resorting to pkill to stop localsend_cli")
                                os.system('sudo pkill -f localsend_cli')
                                time.sleep(.5)
                        self.localsend_process = None
                    else:
                        if self.DEBUG:
                            print("set_localsend: was asked to stop localsend, but it's not running?")
            

        except Exception as ex:
            if self.DEBUG:
                print("\nERROR, caught error in set_localsend: "  + str(ex))
        
        





    def check_photo_printer(self):
        if self.DEBUG:
            print("Checking if a cups or bluetooth photo printer is paired")
        
        self.cups_printer_available = False
        self.peripage_printer_available = False
        
        if os.path.exists(self.boot_path + '/candle_disable_printing.txt'):
            self.printing_allowed = False
            if self.DEBUG:
                print("spotted candle_disable_printing.txt, not allowing printing")
            return
        else:
            self.printing_allowed = True

        try:
            
            lpstat_output = run_command("lpstat -v")
            if 'No destinations added' in lpstat_output:
                if self.DEBUG:
                    print("No network printers connected")
                
                
                # See if there is a Peripage photo printer connected
                if os.path.isdir(self.external_picture_drop_dir):
                    if self.DEBUG:
                        print("privacy manager photo drop-off dir existed")
                    bluetooth_printer_check = run_command('sudo bluetoothctl paired-devices')
                    if self.DEBUG:
                        print("bluetooth_printer_check: " + str(bluetooth_printer_check))
                    if 'peripage' in bluetooth_printer_check.lower():
                        self.peripage_printer_available = True
                        if self.DEBUG:
                            print("paired bluetooth printer was detected")
                        return True
              
            
            
            else:
                if self.DEBUG:
                    print("a cups printer is connected")
                self.cups_printer_available = True
                return True
            
                    
        except Exception as ex:
            print("Error while checking for printer: " + str(ex))
        
        return False
        


    def unload(self):
        if self.DEBUG:
            print("Shutting down")
        self.running = False
        time.sleep(1)
        os.system('sudo pkill -f localsend')
        return True



    def save_photo(self,filename, filedata, parts_total, parts_current):
        if self.DEBUG:
            print("in file save method. Filename: " + str(filename))

        result = []
        
        filename = re.sub("[^a-zA-Z0-9.]","_",filename)
        
        #filename = "".join([c for c in filename if re.match(r'\w\.', c)])
        #re.sub("^[a-zA-Z0-9.]","_",filename)
        #print("2: " + str(filename))
        #filename = str(int(time.time())) + "-" + filename
        #print("3: " + str(filename))
        
        #filename = str(int(time())) + "-" + re.sub("[ˆa-zA-Z0-9\.]","_",filename)
        if self.DEBUG:
            print("in file save method. Cleaned filename: " + str(filename))
        save_path = os.path.join(self.photos_dir_path, str(filename))
        #if self.DEBUG:
        #    print("file will be saved to: " + str(save_path))
        base64_data = re.sub('^data:image/.+;base64,', '', filedata)
        
        #print("4")
        # DEBUG save extra file with base64 data:
        #try: 
        #    with open(save_path + ".txt", "w") as fh:
                #fh.write(base64.decodebytes(filedata.encode()))
        #        fh.write(base64_data)
        #except:
        #    print("Saved debug file")

        # delete existing file first, if it exists:
        try:
            if os.path.isfile(save_path) and parts_current == 1:
                if self.DEBUG:
                    print("file already existed, deleting it first")
                os.remove(save_path)
        except Exception as ex:
            print("Error deleting existing file first: " + str(ex))

        # Save file
        try:
            if filename.endswith('.jpg') or filename.endswith('.jpeg') or filename.endswith('.gif') or filename.endswith('.png') or filename.endswith('.webp'):
                if self.DEBUG:
                    print("saving to file: " + str(save_path))
                with open(save_path, "wb") as fh:
                    fh.write(base64.b64decode(base64_data))
                result = self.scan_photo_dir()
                if self.persistent_data['added_a_photo'] == False:
                    self.persistent_data['added_a_photo'] = True
                    self.save_persistent_data()
        except Exception as ex:
            if self.DEBUG:
                print("caught error saving photo to file: " + str(ex))

        if self.DEBUG:
            print("photo saved")
        
        return result





    def save_persistent_data(self):
        if self.DEBUG:
            print("Saving to persistence data store")



        try:
            json.dump( self.persistent_data, open( self.persistence_file_path, 'w+' ) )
            if self.DEBUG:
                print("OK, saved persistent_data")
        except Exception as ex:
            if self.DEBUG:
                print("caught error saving to persistence file: " + str(ex))
            
        """
        try:
            if not os.path.isfile(self.persistence_file_path):
                open(self.persistence_file_path, 'a').close()
                if self.DEBUG:
                    print("Created an empty persistence file")
            else:
                if self.DEBUG:
                    print("Persistence file existed. Will try to save to it.")

            with open(self.persistence_file_path) as f:
                if self.DEBUG:
                    print("saving: " + str(self.persistent_data))
                try:
                    json.dump( self.persistent_data, open( self.persistence_file_path, 'w+' ) )
                except Exception as ex:
                    print("Error saving to persistence file: " + str(ex))
                return True
            #self.previous_persistent_data = self.persistent_data.copy()

        except Exception as ex:
            if self.DEBUG:
                print("Error: could not store data in persistent store: " + str(ex) )
            return False
        """


def run_command(cmd, timeout_seconds=20):
    try:
        
        p = subprocess.run(cmd, timeout=timeout_seconds, stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=True, universal_newlines=True)

        if p.returncode == 0:
            return p.stdout # + '\n' + "Command success" #.decode('utf-8')
            #yield("Command success")
        else:
            if p.stderr:
                return "Error: " + str(p.stderr) # + '\n' + "Command failed"   #.decode('utf-8'))

    except Exception as e:
        print("photo frame caught error running command: "  + str(e))
    return None
        
def generate_random_string(length):
    letters = string.ascii_lowercase
    return ''.join(random.choice(letters) for i in range(length))
