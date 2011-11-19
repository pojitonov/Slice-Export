/* ===========================================================================
	
	File: Copy Merged Utilities

	Author - John Dunning
	Copyright - 2010 John Dunning.  All rights reserved.
	Email - fw@johndunning.com
	Website - http://johndunning.com/fireworks

	Release - 1.5.0 ($Revision: 1.5 $)
	Last update - $Date: 2010/03/13 02:18:15 $

   ======================================================================== */


/*
	To do:
		- if selection doesn't intersect anything, the whole document is copied
			for bitmap selections, there's nothing to do, because the flattened
				copy has already been copied to the clipboard, and restoring a
				selection and then copying it doesn't affect the clipboard if the
				selection doesn't intersect.  so the whole bitmaps is still on
				the clipboard.

		- doesn't work with empty web sublayers
			seems to copy the slice as well 

		- paste copied pixels into same layer as destination object, not source object
			the problem is there's no way to tell which layer an element is on,
				since dom.currentLayerNum doesn't update while the command is running
			so there's no way to move the new destination object to the original
				layer
		
	Done:
		- support locked elements when layer isn't locked
			would have to keep track of all locked elements and relock them 
*/


try {

(function()
{
	jdlib = jdlib || {};
	jdlib.CopyMerged = jdlib.CopyMerged || {};


	// =======================================================================
	function createFlattenedCopy(
		inCropBounds)
	{
		var dom	= fw.getDocumentDOM();

		var lockedLayers = [];
		var lockedElements = [];

			// check which layers are locked
		for (var i = 0; i < dom.layers.length; i++) {
			var layer = dom.layers[i];

				// check if the layer is locked in the current frame
			if (layer.frames[dom.currentFrameNum].locked) {
				lockedLayers.push(i);
			}
		}

			// unlock all the layers
		dom.setLayerLocked(-1, -1, false, true);

			// lock the web layer so we don't copy any slices
		dom.setLayerLocked(dom.layers.length - 1, -1, true, false);

			// make a copy of everything and flatten it into a bitmap.  we first
			// select none to make sure any temp bitmap from a marquee selection is gone.
		dom.selectNone();
		dom.selectAll();
		dom.cloneSelection();
		dom.flattenSelection();

		if (inCropBounds) {
				// crop the bitmap to the bounds of the selection
			dom.cropSelection(inCropBounds);
		}

		var copyBounds = dom.getSelectionBounds();
		var copyPosition = null;

			// make sure there's still a selection after cropping.  if the crop area
			// doesn't intersect with anything in the flattened copy, then there won't be.
		if (copyBounds) {
			copyPosition = { x: copyBounds.left, y: copyBounds.top };

				// cut the bitmap to the clipboard, to make it available to other apps
			dom.clipCut();
			dom.selectNone();
		}

			// unlock the web layer.  if it was locked previously, it will be
			// re-locked below
		dom.setLayerLocked(dom.layers.length - 1, -1, false, false);

			// relock all the layers that we unlocked, possibly including the web layer
		for (var i = 0; i < lockedLayers.length; i++) {
				// use the dom method rather than .locked so that we handle sublayers
			dom.setLayerLocked(lockedLayers[i], dom.currentFrameNum, true, false);
		}

			// return the position of the merged copy so that the caller knows where
			// to move it if they paste it.  if the document is zoomed in or the copy
			// extended off the canvas, dom.clipPaste() will paste it in the middle
			// of the viewport, which is not where we want it.
		return copyPosition;
	}


	// =======================================================================
	function createFlattenedCopyByExport(
		inCropBounds)
	{
		var dom	= fw.getDocumentDOM();

			// export as a 32 bit PNG so we get whatever transparency may have been
			// used in the current doc
		var exportOptions = {
			animAutoCrop: true,
			animAutoDifference: true,
			applyScale: false,
			colorMode: "32 bit",
			crop: false,
			cropBottom: 0,
			cropLeft: 0,
			cropRight: 0,
			cropTop: 0,
			ditherMode: "none",
			ditherPercent: 100,
			exportFormat: "PNG",
			frameInfo: [  ],
			interlacedGIF: false,
			jpegQuality: 80,
			jpegSelPreserveButtons: false,
			jpegSelPreserveText: true,
			jpegSelQuality: 90,
			jpegSelQualityEnabled: false,
			jpegSmoothness: 0,
			jpegSubsampling: 0,
			localAdaptive: true,
			lossyGifAmount: 0,
			macCreator: "????",
			macFileType: "????",
			name: null,
			numCustomEntries: 0,
			numEntriesRequested: 0,
			numGridEntries: 6,
			optimized: true,
			paletteEntries: null,
			paletteInfo: null,
			paletteMode: "adaptive",
			paletteTransparency: "none",
			percentScale: 100,
			progressiveJPEG: false,
			savedAnimationRepeat: 0,
			sorting: "none",
			useScale: true,
			webSnapAdaptive: false,
			webSnapTolerance: 14,
			xSize: 0,
			ySize: 0
		};

			// add the .png to the temp path, since exporting to PNG will add it anyway
		var tempPath = Files.getTempFilePath(null) + ".png";

			// remember the current canvas color and then switch it to 100% transparent
			// so that we preserve any transparency in the elements we're copying
		var originalBackground = dom.backgroundColor;
		dom.backgroundColor = "#ffffff00";

		dom.exportTo(tempPath, exportOptions);

		dom.backgroundColor = originalBackground;

		dom.importFile(tempPath, {
			left: 0,
			right: 0,
			top: 0,
			bottom: 0
		}, true);

			// get rid of the temp file
		Files.deleteFileIfExisting(tempPath);

		if (inCropBounds) {
				// crop the bitmap to the bounds of the selection
			dom.cropSelection(inCropBounds);
		}

		var copyBounds = dom.getSelectionBounds();
		var copyPosition = null;

			// make sure there's still a selection after cropping.  if the crop area
			// doesn't intersect with anything in the flattened copy, then there won't be.
		if (copyBounds) {
			copyPosition = { x: copyBounds.left, y: copyBounds.top };

				// cut the bitmap to the clipboard, to make it available to other apps
			dom.clipCut();
			dom.selectNone();
		}

			// return the position of the merged copy so that the caller knows where
			// to move it if they paste it.  if the document is zoomed in or the copy
			// extended off the canvas, dom.clipPaste() will paste it in the middle
			// of the viewport, which is not where we want it.
		return copyPosition;
	}


	// =======================================================================
	jdlib.CopyMerged.handleCopy = function(
		inFilename)
	{
		if (fw.documents.length < 1) {
				// no documents are open
			return;
		}

		var dom	= fw.getDocumentDOM();
		var cropBounds = null;
		var cropToMarquee = false;

			// we handle marquee selections differently than an object selection so
			// that the feathering and shape of the marquee is respected, since
			// createFlattenedCopy can only crop to rectangular bounds
		if (dom.isPaintMode) {
			dom.saveSelection();
			cropToMarquee = true;
		} else if (fw.selection.length > 0) {
				// we'll use the bounds of the selected objects to crop the pixels
			cropBounds = dom.getSelectionBounds();
		}

			// if there's a marquee selection, make sure we exit the paint mode
			// before storing the selection.  otherwise, the virtual bitmap that
			// FW creates when marqueeing over open canvas would be part of the
			// selection, and restoring it would cause an error.
		dom.exitPaintMode();

			// store the current selection so we can restore it later, since we'll
			// be doing a select all below
		var originalSelection = [].concat(fw.selection);

			// make sure that pesky virtual bitmap is gone
		dom.selectNone();

		if (inFilename.indexOf("Locked") > -1) {
				// save the original location of the selection so that we can put in the
				// right place if we paste below
			var copyPosition = createFlattenedCopyByExport(cropBounds);
		} else {
			var copyPosition = createFlattenedCopy(cropBounds);
		}

		if (!copyPosition) {
			alert("No elements intersected the selection, so nothing was copied.");
		} else if (cropToMarquee) {
			dom.clipPaste("do not resample", null);

				// if the user is zoomed in or if the copy's origin was negative,
				// clipPaste won't put it in the original place
			dom.moveSelectionTo(copyPosition, false, false)
			dom.restoreSelection();
			dom.clipCopy();
			dom.exitPaintMode();
			dom.deleteSelection(false);
		}

			// restore the original selection
		fw.selection = originalSelection;
	}


	// =======================================================================
	jdlib.CopyMerged.handleCopySelection = function(
		inFilename)
	{
		if (fw.documents.length < 1 || fw.selection.length == 0) {
				// no documents are open or there's no selection
			return;
		}

		var dom	= fw.getDocumentDOM();

			// save the currently active tool, since going into bitmap mode always
			// sets it to the marquee
		var activeTool = fw.activeTool;

		var sourceIsCopy = false;
		var sourceBitmap = null;
		var destinationObjects = null;

		if (fw.selection.length == 1) {
			var boundsElement = fw.selection[0];
			boundsElement.visible = false;
			dom.selectNone();

			if (inFilename.indexOf("Locked") > -1) {
					// save the original location of the selection so that we can put in the
					// right place if we paste below
				var copyPosition = createFlattenedCopyByExport();
			} else {
				var copyPosition = createFlattenedCopy();
			}

				// createFlattenedCopy copies the pixels to the clipboard so that
				// it doesn't get stuck in a locked layer.  we paste it on to the
				// boundsElement's layer, which is guaranteed to not be locked.
			boundsElement.visible = true;
			destinationObjects = [boundsElement];
			dom.clipPaste("do not resample");

				// if the user is zoomed in or if the copy's origin was negative,
				// clipPaste won't put it in the original place, so move it
			dom.moveSelectionTo(copyPosition, false, false)

				// remember that we created a copy of the whole doc so that we can
				// delete it after copying it into each of the destination objects
			sourceBitmap = fw.selection[0];
			sourceIsCopy = true;
		} else {
				// the destination objects will be the current selection, minus the
				// source bitmap, which should be last
			destinationObjects = [].concat(fw.selection);
			sourceBitmap = destinationObjects.pop();

			if (sourceBitmap.toString() != "[object Image]") {
					// the source isn't a bitmap, so make a bitmap copy of it from which
					// we can copy pixels
				fw.selection = [sourceBitmap];
				dom.cloneSelection();
				dom.flattenSelection();

				sourceBitmap = fw.selection[0];
				sourceIsCopy = true;
			}
		}

		fw.selection = [sourceBitmap];
		var sourceBounds = dom.getSelectionBounds();
		var foundNonintersection = false;

		for (var i = 0; i < destinationObjects.length; i++) {
			var destination = destinationObjects[i];
			var destinationType = getElementType(destination);

			if (destinationType == "Path" && !destination.contours[0].isClosed) {
					// turn unclosed paths into a bitmap and use that as the destination,
					// so we'll include the pixels under the path stroke, which we
					// ignore for closed paths.  if the unclosed path has a fill, that
					// will also be included in the bitmap.
				fw.selection = [destination];
				dom.flattenSelection();
				destination = fw.selection[0];
				destinationType = getElementType(destination);
			}

			fw.selection = [destination];
			var destinationBounds = dom.getSelectionBounds();

			if (destinationBounds.left > sourceBounds.right || destinationBounds.right < sourceBounds.left ||
					destinationBounds.top > sourceBounds.bottom || destinationBounds.bottom < sourceBounds.top) {
				foundNonintersection = true;
				destinationObjects[i] = null;
				continue;
			}

				// convert the destination object into a bitmap selection
			switch (destinationType) {
				case "Text":
						// turn the text block into a single path
					dom.convertToPaths();
					dom.ungroup();
					dom.pathUnion();
					destination = fw.selection[0];

					// fall through to the path case, since the text is now a path

				case "Path":
				case "RectanglePrimitive":
						// default to a hard edge and no feather
					var marqueeMode = 1;
					var feather = 0;
					var fill = destination.pathAttributes.fill;

						// make sure there's a fill on the object before trying to
						// access it, since paths with just a stroke would cause an error
					if (fill) {
						feather = fill.feather;

							// despite what the docs say, only numbers for the marquee
							// mode seem to work
						if (fill.edgeType == "hard") {
							marqueeMode = 1;		// "hard edge"
						} else {
							marqueeMode = 2;		// "antialias"

							if (feather > 0) {
								marqueeMode = 3;	// "feather"
							}
						}
					}

						// convert the path to a marquee selection and save it.
						// this operation consumes the original path, so we don't
						// need to delete it as we do bitmaps. 
					dom.convertPathToMarquee(marqueeMode, feather);
					dom.saveSelection();
					dom.exitPaintMode();
					break;

				case "Image":
					dom.enterPaintMode();
					dom.selectAll();

						// force the marquee to snap to the actual pixels by "moving"
						// the selection by 0
					dom.moveSelectionBy({x:0, y:0}, false, true);
					dom.saveSelection();
					dom.exitPaintMode();

						// we're done with the destination bitmap now
					dom.deleteSelection(false);
					break;
			}

				// copy the pixels in the stored selection from the source bitmap
			fw.selection = [sourceBitmap];
			dom.restoreSelection();
			dom.clipCopy();
			dom.exitPaintMode();
			dom.selectNone();

			dom.clipPaste("do not resample", null);

				// store the new bitmap so we select it when we're done
			destinationObjects[i] = fw.selection[0];
		}

		if (sourceIsCopy) {
				// we created the source using createFlattenedCopy, so now we need
				// to delete the copy so it doesn't hang around
			fw.selection = [sourceBitmap];
			dom.deleteSelection(false);
		}

		fw.selection = destinationObjects;

			// force the tool back to the Pointer, as restoring it to the
			// previously active tool doesn't seem to work if the command shortcut
			// includes the ctrl key.  
		fw.activeTool = "Pointer";

		if (foundNonintersection) {
			alert("One or more of the selected elements did not intersect the bottom-most element, so there are no merged pixels to copy into them.");
		}

		function getElementType(
			inElement)
		{
			return (inElement + "").match(/object (.+)\]/)[1];
		}
	}


	// =======================================================================
	jdlib.CopyMerged.handleCopyNewDocument = function(
		inFilename)
	{
		var dom = fw.getDocumentDOM();
		var bounds = dom.getSelectionBounds();

			// copy the flatened selection to the clipboard.  pass our filename to
			// handleCopy so it knows which version of createFlattenedCopy to use.
		jdlib.CopyMerged.handleCopy(inFilename);

			// paste the flattened pixels to see where they are in relation to the
			// object that specified the selection bounds (e.g., a slice).  we need
			// this to position the pixels correctly in the new document, if the
			// pixel area is smaller than the selection area.
		dom.clipPaste();
		var pastedBounds = dom.getSelectionBounds();
		var deltaX = pastedBounds.left - bounds.left;
		var deltaY = pastedBounds.top - bounds.top;
		dom.deleteSelection(false);

			// create a new doc as large as the selection, not the pixels.  make the
			// dpi the same as the current document.
		fw.createFireworksDocument({ x: bounds.right - bounds.left, y: bounds.bottom - bounds.top },
			{ pixelsPerUnit: dom.resolution, units: dom.resolutionUnits }, "#ffffff");

			// use getDocumentDOM() again here because the dom has changed, so we need
			// to reference the new one
		dom = fw.getDocumentDOM();
		dom.clipPaste("do not resample");
		dom.moveSelectionTo({ x: deltaX, y: deltaY }, false, false);
	}
})();

} catch (exception) {
	alert([exception, exception.lineNumber, exception.fileName].join("\n"));
}
