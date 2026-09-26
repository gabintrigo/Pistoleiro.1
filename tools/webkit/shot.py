import gi, sys, json, time, os
gi.require_version('Gtk','3.0'); gi.require_version('WebKit2','4.1')
import cairo
from gi.repository import Gtk, WebKit2, GLib
url=sys.argv[1]; W=int(sys.argv[2]); H=int(sys.argv[3]); script=sys.argv[4]  # script: JSON list of [delay_ms, js, shot_name_or_null]
steps=json.load(open(script))
win=Gtk.OffscreenWindow(); win.set_default_size(W,H)
ctx=WebKit2.WebContext.get_default()
s=WebKit2.Settings(); s.set_enable_webgl(True); s.set_enable_javascript(True); s.set_allow_file_access_from_file_urls(True); s.set_allow_universal_access_from_file_urls(True); s.set_enable_developer_extras(True); s.set_enable_write_console_messages_to_stdout(True); s.set_hardware_acceleration_policy(WebKit2.HardwareAccelerationPolicy.ALWAYS)
wv=WebKit2.WebView.new_with_context(ctx); wv.set_settings(s); wv.set_size_request(W,H); win.add(wv); win.show_all()
results=[]
def run(i):
    if i>=len(steps): Gtk.main_quit(); return
    delay,js,shot=steps[i]
    def after():
        def cb(view,res):
            try:
                v=view.run_javascript_finish(res); jsv=v.get_js_value(); out=jsv.to_string() if jsv else ''
            except Exception as e: out='JSERR '+str(e)
            print('STEP',i,'->',out[:1500],flush=True)
            if shot:
                def scb(view,res2):
                    try:
                        surf=view.get_snapshot_finish(res2); surf.write_to_png(shot); print('SHOT',shot,flush=True)
                    except Exception as e: print('SHOTERR',e,flush=True)
                    run(i+1)
                view.get_snapshot(WebKit2.SnapshotRegion.VISIBLE,WebKit2.SnapshotOptions.NONE,None,scb)
            else: run(i+1)
        wv.run_javascript(js,None,cb)
        return False
    GLib.timeout_add(delay,after)
def loaded(view,event):
    if event==WebKit2.LoadEvent.FINISHED: run(0)
wv.connect('load-changed',loaded)
wv.load_uri(url)
GLib.timeout_add(240000,Gtk.main_quit)
Gtk.main()
