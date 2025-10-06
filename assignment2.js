import vertexShaderSrc from './vertex.glsl.js';
import fragmentShaderSrc from './fragment.glsl.js'

var gl = null;
var vao = null;
var program = null;
var vertexCount = 0;
var uniformModelViewLoc = null;
var uniformProjectionLoc = null;
var uniformHeightScaleLoc = null;
var heightmapData = null;

var wireframeVAO = null;
var wireframeVertexCount = 0

function processImage(img)
{
	// draw the image into an off-screen canvas
	var off = document.createElement('canvas');
	
	var sw = img.width, sh = img.height;
	off.width = sw; off.height = sh;
	
	var ctx = off.getContext('2d');
	ctx.drawImage(img, 0, 0, sw, sh);
	
	// read back the image pixel data
	var imgd = ctx.getImageData(0,0,sw,sh);
	var px = imgd.data;
	
	// create a an array will hold the height value
	var heightArray = new Float32Array(sw * sh);
	
	// loop through the image, rows then columns
	for (var y=0;y<sh;y++) 
	{
		for (var x=0;x<sw;x++) 
		{
			// offset in the image buffer
			var i = (y*sw + x)*4;
			
			// read the RGB pixel value
			var r = px[i+0], g = px[i+1], b = px[i+2];
			
			// convert to greyscale value between 0 and 1
			var lum = (0.2126*r + 0.7152*g + 0.0722*b) / 255.0;

			// store in array
			heightArray[y*sw + x] = lum;
		}
	}

	return {
		data: heightArray,
		width: sw,
		height: sw
	};
}

function generateTerrainMesh(heightmapData) {
	// for this implementation, i have used separate buffers for triangle mesh and wireframe. 
	// however, using push() with big files caused performance issues. so i have pre-allocated the arrays. 
	// in future we can work with indices and a single buffer to reduce memory usage.

	var width = heightmapData.width;
	var height = heightmapData.height;
	var data = heightmapData.data;

	// calculate array sizes upfront
	var numQuads = (width - 1) * (height - 1);
	var numTriangles = numQuads * 2;
	var numVertices = numTriangles * 3;  
	var numWireframeLines = numQuads * 6;  
	var numWireframeVertices = numWireframeLines * 2;  

	// pre-allocate typed arrays (to address problem with push() and big files)
	var positions = new Float32Array(numVertices * 3);
	var wireframePositions = new Float32Array(numWireframeVertices * 3);
	
	var posIdx = 0;  // idx for positions array
	var wireIdx = 0;  // idx for wireframe array

	// get triangles - 2 for each grid
	for (var row = 0; row < height - 1; row++) {
		for (var col = 0; col < width - 1; col++) {

			var topLeft = row * width + col;
			var topRight = topLeft + 1;
			var bottomLeft = (row + 1) * width + col;
			var bottomRight = bottomLeft + 1;

			var x1 = (col / (width - 1)) * 2 - 1;
			var x2 = ((col + 1) / (width - 1)) * 2 - 1;
			var z1 = (row / (height - 1)) * 2 - 1;
			var z2 = ((row + 1) / (height - 1)) * 2 - 1;

			var y1 = data[topLeft];
			var y2 = data[topRight];
			var y3 = data[bottomLeft];
			var y4 = data[bottomRight];

			// first triangle (top-left, bottom-left, top-right)
			positions[posIdx++] = x1; positions[posIdx++] = y1; positions[posIdx++] = z1;
			positions[posIdx++] = x1; positions[posIdx++] = y3; positions[posIdx++] = z2;
			positions[posIdx++] = x2; positions[posIdx++] = y2; positions[posIdx++] = z1;

			// second triangle (top-right, bottom-left, bottom-right)
			positions[posIdx++] = x2; positions[posIdx++] = y2; positions[posIdx++] = z1;
			positions[posIdx++] = x1; positions[posIdx++] = y3; positions[posIdx++] = z2;
			positions[posIdx++] = x2; positions[posIdx++] = y4; positions[posIdx++] = z2;

			// wireframe line segments with vertex pairs 
			
			// first triangle edges
			wireframePositions[wireIdx++] = x1; wireframePositions[wireIdx++] = y1; wireframePositions[wireIdx++] = z1;
			wireframePositions[wireIdx++] = x1; wireframePositions[wireIdx++] = y3; wireframePositions[wireIdx++] = z2;
			
			wireframePositions[wireIdx++] = x1; wireframePositions[wireIdx++] = y3; wireframePositions[wireIdx++] = z2;
			wireframePositions[wireIdx++] = x2; wireframePositions[wireIdx++] = y2; wireframePositions[wireIdx++] = z1;
			
			wireframePositions[wireIdx++] = x2; wireframePositions[wireIdx++] = y2; wireframePositions[wireIdx++] = z1;
			wireframePositions[wireIdx++] = x1; wireframePositions[wireIdx++] = y1; wireframePositions[wireIdx++] = z1;

			// second triangle edges
			wireframePositions[wireIdx++] = x2; wireframePositions[wireIdx++] = y2; wireframePositions[wireIdx++] = z1;
			wireframePositions[wireIdx++] = x1; wireframePositions[wireIdx++] = y3; wireframePositions[wireIdx++] = z2;
			
			wireframePositions[wireIdx++] = x1; wireframePositions[wireIdx++] = y3; wireframePositions[wireIdx++] = z2;
			wireframePositions[wireIdx++] = x2; wireframePositions[wireIdx++] = y4; wireframePositions[wireIdx++] = z2;
			
			wireframePositions[wireIdx++] = x2; wireframePositions[wireIdx++] = y4; wireframePositions[wireIdx++] = z2;
			wireframePositions[wireIdx++] = x2; wireframePositions[wireIdx++] = y2; wireframePositions[wireIdx++] = z1;
		}
	}

	return {
		positions: positions,
		wireframePositions: wireframePositions
	};
}

window.resetCamera = function()
{
	rotationY = 0;
	rotationZ = 0;
	zoomFactor = 1.0;
	panX = 0;
	panY = 0;
	
	document.getElementById('rotation').value = 0;
	document.getElementById('zrotation').value = 0;
	document.getElementById('scale').value = 100;
	document.getElementById('height').value = 50;
	
	document.getElementById('projection').value = 'perspective';
	
	document.getElementById('wireframe').checked = false;
	
	console.log('Camera reset to default values');
}

window.loadImageFile = function(event)
{

	var f = event.target.files && event.target.files[0];
	if (!f) return;

	// create a FileReader to read the image file
	var reader = new FileReader();
	reader.onload = function()
	{
		// create an internal Image object to hold the image into memory
		var img = new Image();
		img.onload = function()
		{
			// heightmapData is globally defined
			heightmapData = processImage(img);

			// terrain mesh from heightmap
			var terrainMesh = generateTerrainMesh(heightmapData);

			// new buffer with terrain data 
			var posBuffer = createBuffer(gl, gl.ARRAY_BUFFER, terrainMesh.positions);
			vertexCount = terrainMesh.positions.length / 3;

			// wireframe vertex buffer 
			var wireframeBuffer = createBuffer(gl, gl.ARRAY_BUFFER, terrainMesh.wireframePositions);
			wireframeVertexCount = terrainMesh.wireframePositions.length / 3;

			var posAttribLoc = gl.getAttribLocation(program, "position");

			// VAO for solid mesh
			vao = createVAO(gl,
				posAttribLoc, posBuffer,
				null, null,
				null, null
			);

			// separate VAO for wireframe mesh
			wireframeVAO = createVAO(gl,
				posAttribLoc, wireframeBuffer,
				null, null,
				null, null
			);

			console.log('Generated terrain mesh: ' + heightmapData.width + ' x ' + heightmapData.height);
			console.log('Total vertices: ' + vertexCount);
			console.log('Wireframe vertices: ' + wireframeVertexCount);

		};
		img.onerror = function()
		{
			console.error("Invalid image file.");
			alert("The selected file could not be loaded as an image.");
		};

		// the source of the image is the data load from the file
		img.src = reader.result;
	};
	reader.readAsDataURL(f);
}


function setupViewMatrix(eye, target)
{
    var forward = normalize(subtract(target, eye));
    var upHint  = [0, 1, 0];

    var right = normalize(cross(forward, upHint));
    var up    = cross(right, forward);

    var view = lookAt(eye, target, up);
    return view;

}
function draw()
{

	var fovRadians = 70 * Math.PI / 180;
	var aspectRatio = +gl.canvas.width / +gl.canvas.height;
	var nearClip = 0.001;
	var farClip = 20.0;

	// projection mode from dropdown
	var projectionMode = document.getElementById('projection').value;
	var projectionMatrix;
	
	if (projectionMode === 'orthographic') {
		var orthoSize = 3;
		projectionMatrix = orthographicMatrix(
			-orthoSize * aspectRatio, orthoSize * aspectRatio,  // left, right
			-orthoSize, orthoSize,  // bottom, top
			nearClip, farClip
		);
	} else {
  		projectionMatrix = perspectiveMatrix(
			fovRadians,
			aspectRatio,
			nearClip,
			farClip,
		);
	}

	// eye and target
	var eye = [0, 5, 5];
	var target = [0, 0, 0];

	var modelMatrix = identityMatrix();

	var rotationSlider = document.getElementById('rotation');
	var zRotationSlider = document.getElementById('zrotation');
	var scaleSlider = document.getElementById('scale');
	
	var sliderRotationY = (rotationSlider.value * Math.PI) / 180;  
	var sliderRotationZ = (zRotationSlider.value * Math.PI) / 180;  
	var sliderZoom = scaleSlider.value / 100.0; 
	
	// combine slider values with mouse-based controls
	var totalRotationY = rotationY + sliderRotationY;
	var totalRotationZ = rotationZ + sliderRotationZ;
	var totalZoom = zoomFactor * sliderZoom;

	var scaleMatrix_zoom = scaleMatrix(totalZoom, totalZoom, totalZoom);
	var rotationYMatrix = rotateYMatrix(totalRotationY);
	var rotationZMatrix = rotateZMatrix(totalRotationZ);
	var panMatrix = translateMatrix(panX, panY, 0);
	
	modelMatrix = multiplyArrayOfMatrices([panMatrix, rotationZMatrix, rotationYMatrix, scaleMatrix_zoom]);

	// setup viewing matrix
	var eyeToTarget = subtract(target, eye);
	var viewMatrix = setupViewMatrix(eye, target);

	// model-view Matrix = view * model
	var modelviewMatrix = multiplyMatrices(viewMatrix, modelMatrix);


	// enable depth testing
	gl.enable(gl.DEPTH_TEST);

	// disable face culling to render both sides of the triangles
	gl.disable(gl.CULL_FACE);

	gl.clearColor(0.2, 0.2, 0.2, 1);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
	gl.useProgram(program);
	
	var heightSlider = document.getElementById('height');
	var heightScale = heightSlider.value / 50.0;  // 50 maps to 1.0, 100 maps to 2.0
	
	gl.uniformMatrix4fv(uniformModelViewLoc, false, new Float32Array(modelviewMatrix));
	gl.uniformMatrix4fv(uniformProjectionLoc, false, new Float32Array(projectionMatrix));
	gl.uniform1f(uniformHeightScaleLoc, heightScale);

	gl.bindVertexArray(vao);
	
	// wireframe mode support
	var wireframeCheckbox = document.getElementById('wireframe');
	var isWireframe = wireframeCheckbox.checked;
	
	if (isWireframe && wireframeVAO !== null) {
		// wireframe mode: draw lines using wireframe VAO
		gl.bindVertexArray(wireframeVAO);
		gl.drawArrays(gl.LINES, 0, wireframeVertexCount);
	} else {
		// solid mode: draw triangles
		gl.bindVertexArray(vao);
		gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
	}
	
	requestAnimationFrame(draw);

}

function createBox()
{
	function transformTriangle(triangle, matrix) {
		var v1 = [triangle[0], triangle[1], triangle[2], 1];
		var v2 = [triangle[3], triangle[4], triangle[5], 1];
		var v3 = [triangle[6], triangle[7], triangle[8], 1];

		var newV1 = multiplyMatrixVector(matrix, v1);
		var newV2 = multiplyMatrixVector(matrix, v2);
		var newV3 = multiplyMatrixVector(matrix, v3);

		return [
			newV1[0], newV1[1], newV1[2],
			newV2[0], newV2[1], newV2[2],
			newV3[0], newV3[1], newV3[2]
		];
	}

	var box = [];

	var triangle1 = [
		-1, -1, +1,
		-1, +1, +1,
		+1, -1, +1,
	];
	box.push(...triangle1)

	var triangle2 = [
		+1, -1, +1,
		-1, +1, +1,
		+1, +1, +1
	];
	box.push(...triangle2);

	// 3 rotations of the above face
	for (var i=1; i<=3; i++) 
	{
		var yAngle = i* (90 * Math.PI / 180);
		var yRotMat = rotateYMatrix(yAngle);

		var newT1 = transformTriangle(triangle1, yRotMat);
		var newT2 = transformTriangle(triangle2, yRotMat);

		box.push(...newT1);
		box.push(...newT2);
	}

	// a rotation to provide the base of the box
	var xRotMat = rotateXMatrix(90 * Math.PI / 180);
	box.push(...transformTriangle(triangle1, xRotMat));
	box.push(...transformTriangle(triangle2, xRotMat));


	return {
		positions: box
	};

}

var isDragging = false;
var startX, startY;
var leftMouse = false;

var rotationY = 0;  
var rotationZ = 0;  
var zoomFactor = 1.0;  

var panX = 0;
var panY = 0;

function addMouseCallback(canvas)
{
	isDragging = false;

	canvas.addEventListener("mousedown", function (e) 
	{
		if (e.button === 0) {
			console.log("Left button pressed");
			leftMouse = true;
		} else if (e.button === 2) {
			console.log("Right button pressed");
			leftMouse = false;
		}

		isDragging = true;
		startX = e.offsetX;
		startY = e.offsetY;
	});

	canvas.addEventListener("contextmenu", function(e)  {
		e.preventDefault(); // disables the default right-click menu
	});


	canvas.addEventListener("wheel", function(e)  {
		e.preventDefault(); // prevents page scroll

		if (e.deltaY < 0) 
		{
			// zoom in
			zoomFactor *= 1.1;
		} else {
			// zoom out
			zoomFactor *= 0.9;
		}
	});

	document.addEventListener("mousemove", function (e) {
		if (!isDragging) return;
		var currentX = e.offsetX;
		var currentY = e.offsetY;

		var deltaX = currentX - startX;
		var deltaY = currentY - startY;

		if (leftMouse) {
			rotationY += deltaX * 0.01;
			rotationZ += deltaY * 0.01;
		} else {
			panX += deltaX * 0.01;
			panY -= deltaY * 0.01; 
		}

		startX = currentX;
		startY = currentY;
	});

	document.addEventListener("mouseup", function () {
		isDragging = false;
	});

	document.addEventListener("mouseleave", () => {
		isDragging = false;
	});
}

function initialize() 
{
	var canvas = document.querySelector("#glcanvas");
	canvas.width = canvas.clientWidth;
	canvas.height = canvas.clientHeight;

	gl = canvas.getContext("webgl2");

	// add mouse callbacks
	addMouseCallback(canvas);

	var box = createBox();
	vertexCount = box.positions.length / 3;		// vertexCount is global variable used by draw()
	console.log(box);

	// create buffers to put in box
	var boxVertices = new Float32Array(box['positions']);
	var posBuffer = createBuffer(gl, gl.ARRAY_BUFFER, boxVertices);

	var vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSrc);
	var fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSrc);
	program = createProgram(gl, vertexShader, fragmentShader);

	// attributes (per vertex)
	var posAttribLoc = gl.getAttribLocation(program, "position");

	// uniforms
	uniformModelViewLoc = gl.getUniformLocation(program, 'modelview');
	uniformProjectionLoc = gl.getUniformLocation(program, 'projection');
	uniformHeightScaleLoc = gl.getUniformLocation(program, 'heightScale');

	vao = createVAO(gl, 
		// positions
		posAttribLoc, posBuffer, 

		// normals (unused in this assignments)
		null, null, 

		// colors (not needed--computed by shader)
		null, null
	);

	window.requestAnimationFrame(draw);
}

window.onload = initialize();