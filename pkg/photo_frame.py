"""Photo Frame API handler."""


import functools
import json
import os
import re
import sys
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
#from os import listdir
#from os.path import isfile, join
from time import sleep, time
import random
import datetime
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
    print("Gateway not loaded?!")

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
        
        
        
        self.addon_name = 'photo-frame'
        self.server = 'http://127.0.0.1:8080'
        self.DEV = False
        self.DEBUG = False
            
        self.things = [] # Holds all the things, updated via the API. Used to display a nicer thing name instead of the technical internal ID.
        self.data_types_lookup_table = {}
            
        self.interval = 30
        self.screensaver_delay = 60
        self.fit_to_screen = "mix"
        self.show_clock = False
        self.show_date = False
        self.show_weather = False
        self.photo_printer_available = False
        #os.environ["DISPLAY"] = ":0.0"
            
        self.weather_addon_exists = False
            
        try:
            manifest_fname = os.path.join(
                os.path.dirname(__file__),
                '..',
                'manifest.json'
            )

            with open(manifest_fname, 'rt') as f:
                manifest = json.load(f)

            APIHandler.__init__(self, manifest['id'])
            self.manager_proxy.add_api_handler(self)
            

            # LOAD CONFIG
            try:
                self.add_from_config()
            except Exception as ex:
                print("Error loading config: " + str(ex))

            
            if self.DEBUG:
                print("self.manager_proxy = " + str(self.manager_proxy))
                print("Created new API HANDLER: " + str(manifest['id']))
        except Exception as e:
            print("Failed to init UX extension API handler: " + str(e))
        
        try:
            self.addon_path =  os.path.join(self.user_profile['addonsDir'], self.addon_name)
            #self.persistence_file_folder = os.path.join(self.user_profile['configDir'])
            self.persistence_file_path = os.path.join(self.user_profile['dataDir'], self.addon_name, 'persistence.json')
            self.photos_dir_path = os.path.join(self.addon_path, 'photos')
            self.photos_data_dir_path = os.path.join(self.user_profile['dataDir'], self.addon_name, 'photos')
            self.demo_photo_file_path = os.path.join(self.addon_path, 'demo_photo.jpg')
            self.external_picture_drop_dir = os.path.join(self.user_profile['dataDir'], 'privacy-manager', 'printme')
            self.display_toggle_path = os.path.join(self.user_profile['addonsDir'], 'display-toggle')
            
            # weather
            self.weather_addon_path =  os.path.join(self.user_profile['addonsDir'], 'weather-adapter')
            if os.path.isdir(self.weather_addon_path):
                self.weather_addon_exists = True
            
            if not os.path.isdir(self.photos_data_dir_path):
                if self.DEBUG:
                    print("creating photos directory in data path")
                os.mkdir(self.photos_data_dir_path)
            
            soft_link = 'ln -s ' + str(self.photos_data_dir_path) + " " + str(self.photos_dir_path)
            if self.DEBUG:
                print("linking: " + soft_link)
            os.system('rm -rf ' + str(self.photos_dir_path))
            os.system(soft_link)
            
        except Exception as e:
            print("Failed to make paths: " + str(e))
            
        # Get persistent data
        self.persistent_data = {}
        try:
            with open(self.persistence_file_path) as f:
                self.persistent_data = json.load(f)
                if self.DEBUG:
                    print('self.persistent_data loaded from file: ' + str(self.persistent_data))
                
        except:
            if self.DEBUG:
                print("Could not load persistent data (if you just installed the add-on then this is normal)")

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
        
        
        if len(self.scan_photo_dir()) == 0:
            
            # only copy the demo photo once, so that the user can choose to have no photos at all, which will turn the screensaver into a black screen.
            if not 'demo_photo_copied' in self.persistent_data:
            
                if self.DEBUG:
                    print("no photos yet. Copying demo photo")
            
                os.system('cp ' + str(self.demo_photo_file_path) + ' ' + str(self.photos_data_dir_path))
            
                self.persistent_data = {'demo_photo_copied':True}
                self.save_persistent_data()
        



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

        if 'Interval' in config:
            self.interval = int(config['Interval'])
            if self.DEBUG:
                print("-Interval preference was in config: " + str(self.interval))
                
        if 'Screensaver delay' in config:
            self.screensaver_delay = int(config['Screensaver delay'])
            if self.DEBUG:
                print("-Screensaver delay preference was in config: " + str(self.screensaver_delay))

        if 'Fit to screen' in config:
            self.fit_to_screen = str(config['Fit to screen'])
            if self.DEBUG:
                print("-Fit to screen preference was in config: " + str(self.fit_to_screen))
                
        if 'Show clock' in config:
            self.show_clock = int(config['Show clock'])
            if self.DEBUG:
                print("-Clock preference was in config: " + str(self.show_clock))
                
        if 'Show weather' in config:
            self.show_weather = int(config['Show weather'])
            if self.DEBUG:
                print("-Weather preference was in config: " + str(self.show_weather))

        if 'Show date' in config:
            self.show_date = int(config['Show date'])
            if self.DEBUG:
                print("-Date preference was in config: " + str(self.show_date))





    def handle_request(self, request):
        """
        Handle a new API request for this handler.

        request -- APIRequest object
        """
        
        try:
        
            if request.method != 'POST':
                print("not post")
                return APIResponse(status=404)
            
            if request.path == '/init' or request.path == '/list' or request.path == '/delete' or request.path == '/save' or request.path == '/wake' or request.path == '/print':

                try:
                    
                    if request.path == '/list':
                        if self.DEBUG:
                            print("LISTING")
                        # Get the list of photos
                        try:
                            data = self.scan_photo_dir()
                            if isinstance(data, str):
                                state = 'error'
                            else:
                                state = 'ok'
                                
                            self.check_photo_printer()
                            
                            return APIResponse(
                              status=200,
                              content_type='application/json',
                              content=json.dumps({'state' : state, 
                                                  'data' : data, 'settings': 
                                                            {'interval':self.interval,
                                                            'screensaver_delay': self.screensaver_delay, 
                                                            'fit_to_screen':self.fit_to_screen, 
                                                            'show_clock' : self.show_clock, 
                                                            'show_date' : self.show_date,
                                                            'show_weather' : self.show_weather 
                                                            }, 
                                                    'printer':self.photo_printer_available, 
                                                    'weather_addon_exists':self.weather_addon_exists, 
                                                    'debug':self.DEBUG 
                                                }),
                            )
                        except Exception as ex:
                            print("Error getting init data: " + str(ex))
                            return APIResponse(
                              status=500,
                              content_type='application/json',
                              content=json.dumps("Error while getting thing data: " + str(ex)),
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
                            print("Error getting thing data: " + str(ex))
                            return APIResponse(
                              status=500,
                              content_type='application/json',
                              content=json.dumps("Error while changing point: " + str(ex)),
                            )
                            
                            
                            
                            
                    elif request.path == '/save':
                        #if self.DEBUG:
                        print("SAVING")
                        try:
                            data = []
                            
                            data = self.save_photo(str(request.body['filename']), str(request.body['filedata']), str(request.body['parts_total']), str(request.body['parts_current']) ) #new_value,date,property_id
                            if isinstance(data, str):
                                state = 'error'
                            else:
                                state = 'ok'
                            print("return state: " + str(state))
                            return APIResponse(
                              status=200,
                              content_type='application/json',
                              content=json.dumps({'state' : state, 'data' : data}),
                            )
                        except Exception as ex:
                            print("Error saving photo: " + str(ex))
                            return APIResponse(
                              status=500,
                              content_type='application/json',
                              content=json.dumps("Error while saving photo: " + str(ex)),
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
                            print("Error waking dispay: " + str(ex))
                            return APIResponse(
                              status=500,
                              content_type='application/json',
                              content=json.dumps("Error while waking up the display: " + str(ex)),
                            )

                    
                    
                    elif request.path == '/print':
                        if self.DEBUG:
                            print("printing")
                        state = 'sent to printer';
                        
                        try:
                            from_filename = os.path.join(self.photos_data_dir_path, str(request.body['filename']))
                            if os.path.isfile(from_filename):
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
                            print("Error sending photo to printer: " + str(ex))
                            return APIResponse(
                              status=500,
                              content_type='application/json',
                              content=json.dumps("Error while sending file to printer drop-off directory: " + str(ex)),
                            )

                        
                        
                    else:
                        return APIResponse(
                          status=500,
                          content_type='application/json',
                          content=json.dumps("API error"),
                        )
                        
                        
                except Exception as ex:
                    print(str(ex))
                    return APIResponse(
                      status=500,
                      content_type='application/json',
                      content=json.dumps("Error"),
                    )
                    
            else:
                print("unknown API path")
                return APIResponse(status=404)
                
        except Exception as e:
            print("Failed to handle UX extension API request: " + str(e))
            return APIResponse(
              status=500,
              content_type='application/json',
              content=json.dumps("API Error"),
            )
        



    # INIT
    def get_init_data(self):
        if self.DEBUG:
            print("Getting the initialisation data")
        





        
    # DELETE A FILE
    
    def delete_file(self,filename):
        result = "error"
        try:
            file_path = os.path.join(self.photos_dir_path, str(filename))
            os.remove(file_path)
            result = self.scan_photo_dir()
        except Exception as ex:
            print("Error deleting photo: " + str(ex))
        
        return result



    def scan_photo_dir(self):
        result = []
        try:
            for fname in os.listdir(self.photos_dir_path):
                if fname.endswith(".jpg") or fname.endswith(".jpeg") or fname.endswith(".gif")  or fname.endswith(".png"):
                    result.append(fname)    
        except:
            print("Error scanning photo directory")
        
        return result



    def check_photo_printer(self):
        if self.DEBUG:
            print("Checking if a bluetooth photo printer is paired")

        try:
            if os.path.isdir(self.external_picture_drop_dir):
                if self.DEBUG:
                    print("privacy manager photo drop-off dir existed")
                bluetooth_printer_check = run_command('sudo bluetoothctl paired-devices')
                if self.DEBUG:
                    print("bluetooth_printer_check: " + str(bluetooth_printer_check))
                if 'peripage' in bluetooth_printer_check.lower():
                    self.photo_printer_available = True
                    if self.DEBUG:
                        print("paired bluetooth printer was detected")
                    return True
            else:
                if self.DEBUG:
                    print("privacy manager photo drop-off dir did not exist, so no photo printing capability available")
                    
        except Exception as ex:
            print("Error while checking photo printer: " + str(ex))
        
        self.photo_printer_available = False
        return False
        


    def unload(self):
        if self.DEBUG:
            print("Shutting down")
        return True



    def save_photo(self,filename, filedata, parts_total, parts_current):
        if self.DEBUG:
            print("in file save method. Filename: " + str(filename))

        result = []
        
        filename = re.sub("[^a-zA-Z0-9.]","_",filename)
        
        #filename = "".join([c for c in filename if re.match(r'\w\.', c)])
        #re.sub("^[a-zA-Z0-9.]","_",filename)
        #print("2: " + str(filename))
        filename = str(int(time())) + "-" + filename
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
            if filename.endswith('.jpg') or filename.endswith('.jpeg') or filename.endswith('.gif') or filename.endswith('.png'):
                if self.DEBUG:
                    print("saving to file: " + str(save_path))
                with open(save_path, "wb") as fh:
                    fh.write(base64.b64decode(base64_data))
                result = self.scan_photo_dir()
        except Exception as ex:
            print("Error saving data to file: " + str(ex))

        if self.DEBUG:
            print("photo saved")
        
        return result



    def save_persistent_data(self):
        if self.DEBUG:
            print("Saving to persistence data store")

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
        print("Error running command: "  + str(e))