<?php
// Minimal name resolution for type IDs using server/storage/data/type_names.json
header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$idsParam = isset($_GET['ids']) ? $_GET['ids'] : '';
if ($idsParam === '') {
  echo json_encode([]);
  exit;
}

$ids = array_filter(array_map('intval', explode(',', $idsParam)), function($v){ return $v > 0; });
$root = dirname(__DIR__, 2);
$file = $root . DIRECTORY_SEPARATOR . 'server' . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'type_names.json';

if (!file_exists($file)) {
  echo json_encode([]);
  exit;
}

$data = json_decode(file_get_contents($file), true);
if (!is_array($data)) {
  echo json_encode([]);
  exit;
}

$map = [];
foreach ($data as $entry) {
  if (isset($entry['type_id']) && isset($entry['type_name'])) {
    $map[intval($entry['type_id'])] = $entry['type_name'];
  }
}

$result = [];
foreach ($ids as $id) {
  if (isset($map[$id])) {
    $result[] = [ 'type_id' => $id, 'type_name' => $map[$id] ];
  }
}

echo json_encode($result);
