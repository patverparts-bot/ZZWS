import hashlib, importlib.util, json, unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location("retention",Path(__file__).resolve().parents[1]/"server/apk_retention.py")
retention=importlib.util.module_from_spec(spec);spec.loader.exec_module(retention)

class Fake:
 def __init__(self,count=4):
  self.data={};self.deletes=[];self.list_calls=0;self.concurrent=False
  for code in range(1,count+1):
   blob=("APK VERSION "+str(code)).encode()*10;digest=hashlib.sha256(blob).hexdigest();path="files/"+digest+".apk"
   item={"schemaVersion":1,"package":"am.zzws.admin","versionCode":code,"version":"7.1."+str(code),"bytes":len(blob),"sha256":digest,"objectPath":path,"filename":"ZZWS-7.1."+str(code)+"-production.apk"}
   self.data[path]=blob;self.data[f"releases/{code:010d}.json"]=json.dumps(item).encode()
 def list_names(self):
  self.list_calls+=1
  names=sorted([p.removeprefix("releases/") for p in self.data if p.startswith("releases/")],reverse=True)
  return names+["0000000000.json"] if self.concurrent and self.list_calls==2 else names
 def read(self,path):return self.data[path]
 def remove(self,paths):
  self.deletes.extend(paths)
  for path in paths:self.data.pop(path,None)

class RetentionTests(unittest.TestCase):
 def test_dry_run_verifies_without_deleting(self):
  store=Fake();result=retention.retain(store)
  self.assertEqual(result["retainedVersions"],["7.1.4","7.1.3"]);self.assertEqual(store.deletes,[]);self.assertFalse(result["applied"])
 def test_cleanup_then_idempotent_retry(self):
  store=Fake();result=retention.retain(store,True)
  self.assertEqual(result["oldApks"],2);self.assertEqual(len(store.data),4);self.assertEqual(retention.retain(store,True)["oldApks"],0)
 def test_corrupt_keeper_never_deletes(self):
  store=Fake();item=json.loads(store.data["releases/0000000004.json"]);store.data[item["objectPath"]]=b"corrupt"
  with self.assertRaises(ValueError):retention.retain(store,True)
  self.assertEqual(store.deletes,[])
 def test_invalid_manifest_cannot_expand_scope(self):
  store=Fake();item=json.loads(store.data["releases/0000000001.json"]);item["objectPath"]="../unrelated";store.data["releases/0000000001.json"]=json.dumps(item).encode()
  with self.assertRaises(ValueError):retention.retain(store,True)
  self.assertEqual(store.deletes,[])
 def test_concurrent_publication_aborts_before_delete(self):
  store=Fake();store.concurrent=True
  with self.assertRaises(RuntimeError):retention.retain(store,True)
  self.assertEqual(store.deletes,[])
 def test_one_release_and_unpublished_upload_are_preserved(self):
  store=Fake(1);store.data["files/"+"a"*64+".apk"]=b"in-flight"
  result=retention.retain(store,True)
  self.assertEqual(result["retainedVersions"],["7.1.1"]);self.assertEqual(len(store.data),3);self.assertEqual(store.deletes,[])
 def test_mismatched_version_stops_cleanup(self):
  store=Fake();item=json.loads(store.data["releases/0000000004.json"]);item["versionCode"]=3;store.data["releases/0000000004.json"]=json.dumps(item).encode()
  with self.assertRaises(ValueError):retention.retain(store,True)
  self.assertEqual(store.deletes,[])
 def test_storage_listing_paginates(self):
  class Paged(retention.Storage):
   def __init__(self):self.calls=[]
   def request(self,method,path,body=None):
    self.calls.append(body["offset"])
    return json.dumps([{"name":f"{code:010d}.json"} for code in range(205,0,-1)][body["offset"]:body["offset"]+body["limit"]]).encode()
  store=Paged();self.assertEqual(len(store.list_names()),205);self.assertEqual(store.calls,[0,100,200])
 def test_storage_delete_rejects_unrelated_path(self):
  store=retention.Storage("test")
  with self.assertRaises(ValueError):store.remove(["project/source.js"])

if __name__=="__main__":unittest.main()
